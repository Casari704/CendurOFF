// ---------------------------------------------------------------
// CendurOFF Admin – API (v2.5)
//
//  - archiv smazaných tras: smazaná trasa se jen schová (routes.deleted_at), admin ji tady
//    vidí, stáhne GPX, obnoví nebo smaže natrvalo
//  - projetí tras: přihlášený uživatel, který při navigaci / záznamu jízdy projede aspoň 20 %
//    trasy, pošle „projeto“; započítá se nejvýš jednou za 24 h (uživatel + trasa)
//
// Do server.js se připojuje jedním řádkem:
//   require('./admin-api').mount(app, { pool, requireAuth, isAdmin });
// ---------------------------------------------------------------

const ADMIN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS route_rides (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coverage REAL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_route_rides_route ON route_rides(route_id, created_at);
CREATE INDEX IF NOT EXISTS idx_route_rides_user ON route_rides(user_id, route_id, created_at);
CREATE TABLE IF NOT EXISTS user_logins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_logins_user ON user_logins(user_id, created_at);
`;

const RIDE_MIN_COVERAGE = 0.2;
const SOURCES = ['atlas', 'roadbook', 'record'];

function mount(app, { pool, requireAuth, isAdmin }) {
  let ready = null;
  function ensure() {
    if (!ready) {
      ready = pool.query(ADMIN_SCHEMA_SQL).catch(err => { ready = null; console.error('Admin: tabulku se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Databáze není připravená.' }));
  const adminOnly = (req, res, next) => isAdmin(req) ? next() : res.status(403).json({ error: 'Jen pro admina.' });

  // ---------------- uživatelé: kdy se naposledy přihlásili ----------------
  app.get('/api/admin/users', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT u.id, u.username, u.display_name, u.role, u.is_approved, u.created_at, u.last_login_at, u.last_seen_at,
               (SELECT COUNT(*)::int FROM routes x WHERE x.owner_id = u.id AND x.deleted_at IS NULL) AS routes,
               (SELECT COUNT(*)::int FROM route_rides rr WHERE rr.user_id = u.id) AS rides,
               (SELECT COUNT(*)::int FROM user_logins l WHERE l.user_id = u.id AND l.created_at > now() - interval '30 days') AS logins_30d,
               (SELECT COUNT(*)::int FROM user_logins l WHERE l.user_id = u.id) AS logins_total
        FROM users u
        ORDER BY COALESCE(u.last_seen_at, u.last_login_at, u.created_at) DESC`);
      res.json(r.rows);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Uživatele se nepodařilo načíst.' }); }
  });

  // ---------------- projetí tras ----------------
  // tělo: { coverage: 0..1, source: 'atlas'|'roadbook'|'record' }
  app.post('/api/routes/:id/ride', whenReady, requireAuth, async (req, res) => {
    try {
      const routeId = Number(req.params.id);
      const coverage = Number(req.body && req.body.coverage);
      if (!Number.isFinite(coverage) || coverage < RIDE_MIN_COVERAGE || coverage > 1.01) {
        return res.status(400).json({ error: 'Projeto méně než 20 % trasy.' });
      }
      const source = SOURCES.includes(req.body.source) ? req.body.source : null;
      const rt = await pool.query('SELECT id FROM routes WHERE id = $1 AND deleted_at IS NULL', [routeId]);
      if (!rt.rows[0]) return res.status(404).json({ error: 'Trasa nenalezena.' });
      // nejvýš jednou za 24 h (podmínka přímo v INSERTu - dva souběžné dotazy nezapočítají dvakrát)
      const r = await pool.query(
        `INSERT INTO route_rides (route_id, user_id, coverage, source)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM route_rides WHERE route_id = $1 AND user_id = $2 AND created_at > now() - interval '24 hours'
         )
         RETURNING id`,
        [routeId, req.user.id, Math.min(1, coverage), source]
      );
      res.json({ counted: r.rows.length > 0 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Projetí se nepodařilo uložit.' });
    }
  });

  // přehled projetí všech tras (admin)
  app.get('/api/admin/stats', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT rt.id AS route_id, rt.name, rt.distance_km, rt.deleted_at IS NOT NULL AS deleted,
                COUNT(rr.id)::int AS rides_total,
                COUNT(rr.id) FILTER (WHERE rr.created_at > now() - interval '30 days')::int AS rides_30d,
                COUNT(DISTINCT rr.user_id)::int AS riders,
                MAX(rr.created_at) AS last_ride
         FROM routes rt LEFT JOIN route_rides rr ON rr.route_id = rt.id
         GROUP BY rt.id
         ORDER BY rides_total DESC, rt.name ASC`
      );
      res.json(r.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Statistiky se nepodařilo načíst.' });
    }
  });

  // projetí jedné trasy: součty + kdo a kolikrát (admin)
  app.get('/api/admin/stats/:routeId', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const routeId = Number(req.params.routeId);
      const sum = await pool.query(
        `SELECT COUNT(*)::int AS rides_total,
                COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS rides_30d,
                COUNT(DISTINCT user_id)::int AS riders
         FROM route_rides WHERE route_id = $1`, [routeId]);
      const who = await pool.query(
        `SELECT u.id AS user_id, u.display_name, COUNT(rr.id)::int AS rides,
                COUNT(rr.id) FILTER (WHERE rr.created_at > now() - interval '30 days')::int AS rides_30d,
                MAX(rr.created_at) AS last_ride
         FROM route_rides rr JOIN users u ON u.id = rr.user_id
         WHERE rr.route_id = $1
         GROUP BY u.id ORDER BY rides DESC, last_ride DESC`, [routeId]);
      res.json(Object.assign({ route_id: routeId, riders_list: who.rows }, sum.rows[0]));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Statistiky se nepodařilo načíst.' });
    }
  });

  // ---------------- archiv smazaných tras ----------------
  app.get('/api/admin/archive', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT rt.id, rt.name, rt.description, rt.distance_km, rt.elev_gain_m, rt.route_type, rt.created_at, rt.deleted_at,
                o.display_name AS owner_display, d.display_name AS deleted_by_display
         FROM routes rt JOIN users o ON o.id = rt.owner_id
         LEFT JOIN users d ON d.id = rt.deleted_by
         WHERE rt.deleted_at IS NOT NULL
         ORDER BY rt.deleted_at DESC`
      );
      res.json(r.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Archiv se nepodařilo načíst.' });
    }
  });

  // body smazané trasy (pro stažení GPX)
  // GPX libovolné trasy – i smazané (v archivu)
  app.get('/api/admin/routes/:id/points', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query('SELECT id, name, points FROM routes WHERE id = $1', [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Trasa už v databázi není (smazaná natrvalo).' });
      res.json(r.rows[0]);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Trasu se nepodařilo načíst.' }); }
  });

  app.get('/api/admin/archive/:id', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query('SELECT id, name, description, points, route_type FROM routes WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Trasa v archivu není.' });
      res.json(r.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Trasu se nepodařilo načíst.' });
    }
  });

  app.post('/api/admin/archive/:id/restore', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query('UPDATE routes SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id', [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Trasa v archivu není.' });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Trasu se nepodařilo obnovit.' });
    }
  });

  // smazání natrvalo (fotky, hodnocení, recenze, roadbook i projetí se smažou kaskádově)
  app.delete('/api/admin/archive/:id', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const r = await pool.query('DELETE FROM routes WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id', [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Trasa v archivu není.' });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Trasu se nepodařilo smazat.' });
    }
  });
}

module.exports = { mount, ADMIN_SCHEMA_SQL };
