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

function mount(app, { pool, requireAuth, isAdmin, atLeast }) {
  let ready = null;
  function ensure() {
    if (!ready) {
      ready = pool.query(ADMIN_SCHEMA_SQL).catch(err => { ready = null; console.error('Admin: tabulku se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  (app.locals.cendurSchemas = app.locals.cendurSchemas || []).push(() => ensure());   // v4.16: kvůli obnově zálohy

  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Databáze není připravená.' }));
  const adminOnly = (req, res, next) => isAdmin(req) ? next() : res.status(403).json({ error: 'Jen pro admina.' });
  const modOnly = (req, res, next) => atLeast(req, 'moderator') ? next() : res.status(403).json({ error: 'Jen pro moderátora a admina.' });
  const ROLES = ['user', 'reporter', 'moderator', 'admin'];

  // ---------------- uživatelé: kdy se naposledy přihlásili ----------------
  app.get('/api/admin/users', whenReady, requireAuth, modOnly, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT u.id, u.username, u.display_name, u.role, u.is_approved, u.created_at, u.last_login_at, u.last_seen_at, u.must_change_password, u.reset_requested_at,
               (SELECT COUNT(*)::int FROM routes x WHERE x.owner_id = u.id AND x.deleted_at IS NULL) AS routes,
               (SELECT COUNT(*)::int FROM routes x WHERE x.owner_id = u.id AND x.deleted_at IS NOT NULL) AS routes_archived,
               (SELECT COUNT(*)::int FROM route_rides rr WHERE rr.user_id = u.id) AS rides,
               (SELECT COUNT(*)::int FROM user_logins l WHERE l.user_id = u.id AND l.created_at > now() - interval '30 days') AS logins_30d,
               (SELECT COUNT(*)::int FROM user_logins l WHERE l.user_id = u.id) AS logins_total
        FROM users u
        ORDER BY u.is_approved ASC, COALESCE(u.last_seen_at, u.last_login_at, u.created_at) DESC`);
      // v4.4: čísla pro hodnost a odznaky (web z nich spočítá, co kdo má)
      let riderBadges = null; try { riderBadges = require('./profile-api').riderBadges; } catch (e) {}
      if (riderBadges) {
        for (const u of r.rows) { try { const b = await riderBadges(pool, u.id); u.stats = b.stats; u.earned = b.earned; } catch (e) { u.stats = null; } }
      }
      res.json(r.rows);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Uživatele se nepodařilo načíst.' }); }
  });

  // ---------------- v4.5: schválení / zamítnutí registrace (místo ruční úpravy v databázi) ----------------
  app.post('/api/admin/users/:id/approve', whenReady, requireAuth, modOnly, async (req, res) => {
    try {
      const r = await pool.query('UPDATE users SET is_approved = true WHERE id = $1 RETURNING id, display_name', [Number(req.params.id)]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Uživatel nenalezen.' });
      res.json({ ok: true, user: r.rows[0] });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Schválení se nepovedlo.' }); }
  });
  // zamítnout jde jen registraci, která ještě nebyla schválená (schválený účet se tu smazat nedá)
  app.delete('/api/admin/users/:id', whenReady, requireAuth, modOnly, async (req, res) => {
    try {
      const r = await pool.query('DELETE FROM users WHERE id = $1 AND is_approved = false RETURNING id', [Number(req.params.id)]);
      if (!r.rows[0]) return res.status(400).json({ error: 'Zamítnout jde jen registraci, která čeká na schválení.' });
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Zamítnutí se nepovedlo.' }); }
  });

  // ---------------- v4.5.2: smazání schváleného účtu ----------------
  // trasy (i ty v archivu smazaných) se nejdřív převedou na jiný účet – v jednom příkazu, nic se neztratí;
  // smažou se jen osobní věci uživatele (jeho hodnocení, recenze, projetí, přihlášení)
  app.post('/api/admin/users/:id/remove', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const to = req.body && req.body.transferTo != null ? Number(req.body.transferTo) : null;
      if (id === req.user.id) return res.status(400).json({ error: 'Vlastní účet tady smazat nejde.' });
      const u = await pool.query('SELECT id, display_name FROM users WHERE id = $1', [id]);
      if (!u.rows[0]) return res.status(404).json({ error: 'Uživatel nenalezen.' });
      const n = await pool.query('SELECT COUNT(*)::int AS n FROM routes WHERE owner_id = $1', [id]);
      const routes = n.rows[0].n;
      if (routes > 0) {
        if (!to || to === id) return res.status(400).json({ error: 'Uživatel má trasy – vyber účet, na který se převedou.' });
        const t = await pool.query('SELECT id FROM users WHERE id = $1 AND is_approved = true', [to]);
        if (!t.rows[0]) return res.status(400).json({ error: 'Trasy jde převést jen na schválený účet.' });
      }
      const r = await pool.query(
        `WITH moved AS (UPDATE routes SET owner_id = $2 WHERE owner_id = $1 AND $2::int IS NOT NULL RETURNING id)
         DELETE FROM users WHERE id = $1 RETURNING (SELECT COUNT(*)::int FROM moved) AS moved`, [id, routes > 0 ? to : null]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Uživatel nenalezen.' });
      res.json({ ok: true, moved: r.rows[0].moved });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Účet se nepodařilo smazat.' }); }
  });

  // ---------------- v4.67: změna role ----------------
  // admin nastaví kterékoli roli (kromě sebe); moderátor jen mezi user a reporter a jen u účtů, které jsou pod ním
  app.post('/api/admin/users/:id/role', whenReady, requireAuth, modOnly, async (req, res) => {
    try {
      const id = Number(req.params.id), role = String(req.body && req.body.role || '');
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Neznámá role.' });
      if (id === req.user.id) return res.status(400).json({ error: 'Vlastní roli změnit nejde.' });
      const t = await pool.query('SELECT role, is_approved FROM users WHERE id = $1', [id]);
      if (!t.rows[0]) return res.status(404).json({ error: 'Uživatel nenalezen.' });
      if (!t.rows[0].is_approved) return res.status(400).json({ error: 'Nejdřív je potřeba účet schválit.' });
      if (!isAdmin(req)) {
        const rank = r => Math.max(0, ROLES.indexOf(r));
        if (rank(t.rows[0].role) >= rank('moderator') || rank(role) >= rank('moderator')) {
          return res.status(403).json({ error: 'Moderátor smí měnit jen role Uživatel a Reporter.' });
        }
      }
      const r = await pool.query('UPDATE users SET role = $2 WHERE id = $1 RETURNING id, display_name, role', [id, role]);
      res.json({ ok: true, role: r.rows[0].role });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Roli se nepodařilo změnit.' }); }
  });

  // ---------------- v4.60: reset hesla ----------------
  // vygeneruje dočasné heslo (admin ho uvidí jednou a předá), uživatel si ho po přihlášení musí změnit
  app.post('/api/admin/users/:id/reset-password', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (id === req.user.id) return res.status(400).json({ error: 'Vlastní heslo si změň v Nastavení účtu.' });
      const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bez zaměnitelných znaků (0 O 1 l I)
      const bytes = require('crypto').randomBytes(8);
      let pw = ''; for (let i = 0; i < 8; i++) pw += alphabet[bytes[i] % alphabet.length];
      const hash = await require('bcryptjs').hash(pw, 10);
      const r = await pool.query(
        'UPDATE users SET password_hash = $2, must_change_password = true, reset_requested_at = NULL WHERE id = $1 AND is_approved = true RETURNING id, username, display_name', [id, hash]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Uživatel nenalezen (nebo ještě není schválený).' });
      console.log('Admin ' + req.user.id + ' resetoval heslo uživateli ' + id);
      res.json({ ok: true, password: pw, username: r.rows[0].username, display_name: r.rows[0].display_name });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Heslo se nepodařilo resetovat.' }); }
  });

  // ---------------- v4.5: změna vlastníka trasy ----------------
  app.patch('/api/admin/routes/:id/owner', whenReady, requireAuth, adminOnly, async (req, res) => {
    try {
      const ownerId = Number(req.body && req.body.ownerId);
      const u = await pool.query('SELECT id, display_name FROM users WHERE id = $1 AND is_approved = true', [ownerId]);
      if (!u.rows[0]) return res.status(400).json({ error: 'Nový vlastník musí být schválený uživatel.' });
      const r = await pool.query('UPDATE routes SET owner_id = $2 WHERE id = $1 RETURNING id', [Number(req.params.id), ownerId]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Trasa nenalezena.' });
      res.json({ ok: true, owner_id: ownerId, owner_display: u.rows[0].display_name });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Vlastníka se nepodařilo změnit.' }); }
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
                rt.owner_id, (SELECT display_name FROM users WHERE id = rt.owner_id) AS owner_display, rt.created_at,
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
