// ---------------------------------------------------------------
// CendurOFF – profil jezdce a hlášení chyb (v4.3)
//
//  - profil jezdce: motorka (volný text) a najeté km – počítají se ze skutečné polohy GPS
//    při navigaci (Atlas NAVI, Roadbook NAVI) a při záznamu jízdy; odznaky podle km
//    počítá web (public/rider.js)
//  - hlášení chyb: web na všech stránkách zachytí chybu skriptu a pošle ji sem;
//    admin je vidí v admin.html („Chyby z telefonů“)
//
// Do server.js se připojuje jedním řádkem (v try/catch – chyba modulu nesmí shodit server):
//   require('./profile-api').mount(app, { pool, requireAuth, optionalAuth, isAdmin });
// ---------------------------------------------------------------

const PROFILE_SCHEMA_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS bike TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ride_m DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ride_m_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS client_errors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  page TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  ua TEXT,
  app_version TEXT,
  web_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors(created_at);
`;

const BIKE_MAX = 60;
const KM_MAX_PER_REQUEST_M = 20000;   // jedno odeslání nejvýš 20 km
const KM_MAX_SPEED_MS = 60;           // a nejvýš ~216 km/h od minulého odeslání
const ERR_PER_IP_PER_MIN = 20;
const ERR_KEEP_DAYS = 60;

function cut(v, n){ return v == null ? null : String(v).slice(0, n); }

function mount(app, { pool, requireAuth, optionalAuth, isAdmin }) {
  let ready = null;
  function ensure() {
    if (!ready) {
      ready = pool.query(PROFILE_SCHEMA_SQL).catch(err => { ready = null; console.error('Profil: tabulky se nepodařilo připravit:', err); throw err; });
    }
    return ready;
  }
  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Databáze není připravená.' }));
  const adminOnly = (req, res, next) => isAdmin(req) ? next() : res.status(403).json({ error: 'Jen pro admina.' });

  // ---------------- profil jezdce ----------------
  app.get('/api/profile', whenReady, requireAuth, async (req, res) => {
    try {
      const r = await pool.query('SELECT id, username, display_name, bike, ride_m FROM users WHERE id = $1', [req.user.id]);
      const u = r.rows[0];
      if (!u) return res.status(404).json({ error: 'Účet nenalezen.' });
      res.json({ id: u.id, username: u.username, displayName: u.display_name, bike: u.bike || '', km: Math.round((u.ride_m || 0) / 100) / 10 });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Profil se nepodařilo načíst.' }); }
  });

  app.put('/api/profile', whenReady, requireAuth, async (req, res) => {
    try {
      const bike = String((req.body && req.body.bike) || '').replace(/\s+/g, ' ').trim().slice(0, BIKE_MAX);
      await pool.query('UPDATE users SET bike = $2 WHERE id = $1', [req.user.id, bike || null]);
      res.json({ ok: true, bike });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Profil se nepodařilo uložit.' }); }
  });

  // najeté metry (web je posílá po dávkách); strop podle času od minulého odeslání
  app.post('/api/profile/km', whenReady, requireAuth, async (req, res) => {
    try {
      const m = Number(req.body && req.body.meters);
      if (!Number.isFinite(m) || m <= 0) return res.status(400).json({ error: 'Neplatná vzdálenost.' });
      const r = await pool.query(
        `UPDATE users SET
           ride_m = ride_m + LEAST($2::double precision, $3::double precision,
             GREATEST(30, EXTRACT(EPOCH FROM (now() - COALESCE(ride_m_at, now() - interval '5 minutes')))) * $4::double precision),
           ride_m_at = now()
         WHERE id = $1
         RETURNING ride_m`,
        [req.user.id, m, KM_MAX_PER_REQUEST_M, KM_MAX_SPEED_MS]
      );
      if (!r.rows[0]) return res.status(404).json({ error: 'Účet nenalezen.' });
      res.json({ km: Math.round(r.rows[0].ride_m / 100) / 10 });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Kilometry se nepodařilo uložit.' }); }
  });

  // veřejný profil jezdce (autor trasy v detailu) – jen jméno, motorka a km
  app.get('/api/riders/:id', whenReady, async (req, res) => {
    try {
      const r = await pool.query('SELECT id, display_name, bike, ride_m FROM users WHERE id = $1 AND is_approved = true', [Number(req.params.id)]);
      const u = r.rows[0];
      if (!u) return res.status(404).json({ error: 'Jezdec nenalezen.' });
      res.json({ id: u.id, displayName: u.display_name, bike: u.bike || '', km: Math.round((u.ride_m || 0) / 100) / 10 });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Profil se nepodařilo načíst.' }); }
  });

  // ---------------- hlášení chyb z webu ----------------
  const hits = new Map();   // ip -> [časy] (omezení počtu hlášení)
  app.post('/api/errors', whenReady, optionalAuth, async (req, res) => {
    try {
      const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
      const now = Date.now();
      const list = (hits.get(ip) || []).filter(t => now - t < 60000);
      if (list.length >= ERR_PER_IP_PER_MIN) return res.status(429).json({ error: 'Moc hlášení.' });
      list.push(now); hits.set(ip, list);
      if (hits.size > 5000) hits.clear();
      const b = req.body || {};
      const message = cut(b.message, 500);
      if (!message) return res.status(400).json({ error: 'Chybí text chyby.' });
      await pool.query(
        `INSERT INTO client_errors (user_id, page, message, stack, ua, app_version, web_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user ? req.user.id : null, cut(b.page, 200), message, cut(b.stack, 4000), cut(b.ua || req.headers['user-agent'], 300), cut(b.appVersion, 20), cut(b.webVersion, 20)]
      );
      // úklid starých hlášení (občas)
      if (Math.random() < 0.05) pool.query(`DELETE FROM client_errors WHERE created_at < now() - interval '${ERR_KEEP_DAYS} days'`).catch(() => {});
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Hlášení se nepodařilo uložit.' }); }
  });

  // přehled pro admina: chyby seskupené podle textu (za 30 dní)
  app.get('/api/admin/errors', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT e.message,
                COUNT(*)::int AS count,
                COUNT(DISTINCT COALESCE(e.user_id::text, e.ua))::int AS devices,
                MAX(e.created_at) AS last_at,
                MIN(e.created_at) AS first_at,
                (ARRAY_AGG(DISTINCT e.page))[1:5] AS pages,
                (ARRAY_AGG(e.stack ORDER BY e.created_at DESC))[1] AS stack,
                (ARRAY_AGG(e.ua ORDER BY e.created_at DESC))[1] AS ua,
                (ARRAY_AGG(e.web_version ORDER BY e.created_at DESC))[1] AS web_version,
                (ARRAY_AGG(e.app_version ORDER BY e.created_at DESC))[1] AS app_version,
                (ARRAY_AGG(DISTINCT u.display_name) FILTER (WHERE u.display_name IS NOT NULL))[1:5] AS users
         FROM client_errors e LEFT JOIN users u ON u.id = e.user_id
         WHERE e.created_at > now() - interval '30 days'
         GROUP BY e.message
         ORDER BY MAX(e.created_at) DESC
         LIMIT 200`
      );
      res.json(r.rows);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Chyby se nepodařilo načíst.' }); }
  });

  app.delete('/api/admin/errors', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const msg = req.query && req.query.message;
      if (msg) await pool.query('DELETE FROM client_errors WHERE message = $1', [String(msg)]);
      else await pool.query('DELETE FROM client_errors');
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Smazání se nepovedlo.' }); }
  });
}

module.exports = { mount, PROFILE_SCHEMA_SQL };
