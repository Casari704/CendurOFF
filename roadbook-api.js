// ---------------------------------------------------------------
// CendurOFF Roadbook – API (v2.0)
//
// Samostatný modul: přidává JEN nové endpointy /api/roadbooks/... a novou tabulku
// `roadbooks`. Stávající tabulky ani endpointy tras nemění – trasy jen čte.
// Do server.js se připojí jedním řádkem (viz konec server.js):
//   require('./roadbook-api').mount(app, { pool, requireAuth, optionalAuth, canEdit });
//
// Jeden roadbook na trasu. Upravovat ho smí vlastník trasy nebo admin, číst kdokoli.
// Stav: 'draft' (Roadbook NOT ready) / 'ready' (Roadbook READY).
// Pojistka: při uložení se k roadbooku zapíše otisk bodů trasy (md5). Když se GPX
// trasy později změní (např. v Plánovači), otisk nesedí → roadbook je "zastaralý"
// a navenek se hlásí jako NOT ready, dokud ho někdo v Roadbook planneru nepřegeneruje
// a znovu neuloží.
// ---------------------------------------------------------------

const ROADBOOK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS roadbooks (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL UNIQUE REFERENCES routes(id) ON DELETE CASCADE,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  data JSONB NOT NULL,
  route_fp TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const STATUSES = ['draft', 'ready'];
const MAX_DATA_CHARS = 3 * 1024 * 1024;   // pojistka na velikost roadbooku (JSON)
const MAX_ITEMS = 3000;

function mount(app, { pool, requireAuth, optionalAuth, canEdit }) {
  // Tabulka se založí sama při prvním dotazu na roadbook (CREATE TABLE IF NOT EXISTS – nic
  // stávajícího nemění). Server začne přijímat dotazy až po initDb(), takže tabulka routes,
  // na kterou roadbooks odkazuje, už v tu chvíli existuje.
  let ready = null;
  function ensureTable() {
    if (!ready) {
      ready = pool.query(ROADBOOK_SCHEMA_SQL)
        .then(() => console.log('Roadbook: tabulka roadbooks je připravená.'))
        .catch(err => { ready = null; console.error('Roadbook: tabulku se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  const whenReady = (req, res, next) => ensureTable().then(() => next(), () => res.status(500).json({ error: 'Roadbook databáze není připravená.' }));

  // efektivní stav: hotový roadbook se změněnou trasou se hlásí jako NOT ready
  // Stav pro zobrazení (v2.10): ready | draft | check
  //   check = trasa (GPX) se od uložení změnila, nebo nějaké místo čeká na kontrolu („ke kontrole“)
  //   (trasa bez uloženého roadbooku = „auto“ – ten se počítá až v prohlížeči / v aplikaci z GPX)
  function effective(row) {
    const stale = row.route_fp !== row.current_fp;
    const review = Number(row.review_count || 0);
    const state = (stale || review > 0) ? 'check' : (row.status === 'ready' ? 'ready' : 'draft');
    return { status: stale ? 'draft' : row.status, saved_status: row.status, stale, review_count: review, state };
  }

  // Přehled stavů všech roadbooků (pro štítky v seznamech tras)
  app.get('/api/roadbooks', whenReady, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT rb.route_id, rb.status, rb.updated_at, rb.route_fp, md5(rt.points::text) AS current_fp,
                jsonb_array_length(COALESCE(rb.data->'items', '[]'::jsonb)) AS item_count,
                (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(rb.data->'items', '[]'::jsonb)) e
                  WHERE e->>'review' = 'true' AND COALESCE(e->>'deleted', 'false') <> 'true') AS review_count
         FROM roadbooks rb JOIN routes rt ON rt.id = rb.route_id
         WHERE rt.deleted_at IS NULL`
      );
      res.json(r.rows.map(row => Object.assign(
        { route_id: row.route_id, updated_at: row.updated_at, item_count: row.item_count },
        effective(row)
      )));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Roadbooky se nepodařilo načíst.' });
    }
  });

  // Jeden roadbook (nebo null, pokud k trase ještě žádný není)
  app.get('/api/roadbooks/:routeId', whenReady, optionalAuth, async (req, res) => {
    try {
      const routeId = Number(req.params.routeId);
      const rt = await pool.query('SELECT id, owner_id FROM routes WHERE id = $1 AND deleted_at IS NULL', [routeId]);
      if (!rt.rows[0]) return res.status(404).json({ error: 'Trasa nenalezena.' });
      // optionalAuth roli nedoplňuje - dočteme ji kvůli oprávnění admina
      if (req.user) {
        const u = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        req.user.role = (u.rows[0] && u.rows[0].role) || 'user';
      }
      const editable = canEdit(req, rt.rows[0].owner_id);
      const r = await pool.query(
        `SELECT rb.*, md5(rt.points::text) AS current_fp, u.display_name AS updated_by_display,
                (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(rb.data->'items', '[]'::jsonb)) e
                  WHERE e->>'review' = 'true' AND COALESCE(e->>'deleted', 'false') <> 'true') AS review_count
         FROM roadbooks rb JOIN routes rt ON rt.id = rb.route_id
         LEFT JOIN users u ON u.id = rb.updated_by
         WHERE rb.route_id = $1`,
        [routeId]
      );
      const row = r.rows[0];
      if (!row) return res.json({ roadbook: null, can_edit: editable });
      res.json({
        roadbook: Object.assign({
          route_id: row.route_id, data: row.data, updated_at: row.updated_at,
          updated_by_display: row.updated_by_display
        }, effective(row)),
        can_edit: editable
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Roadbook se nepodařilo načíst.' });
    }
  });

  // Uložení (založení i přepsání) roadbooku
  app.put('/api/roadbooks/:routeId', whenReady, requireAuth, async (req, res) => {
    try {
      const routeId = Number(req.params.routeId);
      const rt = await pool.query('SELECT id, owner_id, md5(points::text) AS fp FROM routes WHERE id = $1 AND deleted_at IS NULL', [routeId]);
      const route = rt.rows[0];
      if (!route) return res.status(404).json({ error: 'Trasa nenalezena.' });
      if (!canEdit(req, route.owner_id)) return res.status(403).json({ error: 'Roadbook může upravovat jen vlastník trasy (nebo admin).' });

      const status = String(req.body.status || 'draft');
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Neznámý stav roadbooku.' });
      const data = req.body.data;
      if (!data || typeof data !== 'object' || !Array.isArray(data.items)) return res.status(400).json({ error: 'Chybí data roadbooku.' });
      if (data.items.length > MAX_ITEMS) return res.status(400).json({ error: 'Roadbook má příliš mnoho instrukcí.' });
      const json = JSON.stringify(data);
      if (json.length > MAX_DATA_CHARS) return res.status(400).json({ error: 'Roadbook je příliš velký.' });

      const r = await pool.query(
        `INSERT INTO roadbooks (route_id, updated_by, status, data, route_fp)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (route_id) DO UPDATE
           SET updated_by = EXCLUDED.updated_by, status = EXCLUDED.status, data = EXCLUDED.data,
               route_fp = EXCLUDED.route_fp, updated_at = now()
         RETURNING route_id, status, updated_at`,
        [routeId, req.user.id, status, json, route.fp]
      );
      res.json(Object.assign({}, r.rows[0], { stale: false, saved_status: r.rows[0].status }));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Roadbook se nepodařilo uložit.' });
    }
  });

  // Smazání roadbooku (trasa zůstane)
  app.delete('/api/roadbooks/:routeId', whenReady, requireAuth, async (req, res) => {
    try {
      const routeId = Number(req.params.routeId);
      const rt = await pool.query('SELECT owner_id FROM routes WHERE id = $1 AND deleted_at IS NULL', [routeId]);
      if (!rt.rows[0]) return res.status(404).json({ error: 'Trasa nenalezena.' });
      if (!canEdit(req, rt.rows[0].owner_id)) return res.status(403).json({ error: 'Roadbook může smazat jen vlastník trasy (nebo admin).' });
      await pool.query('DELETE FROM roadbooks WHERE route_id = $1', [routeId]);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Roadbook se nepodařilo smazat.' });
    }
  });
}

module.exports = { mount, ROADBOOK_SCHEMA_SQL };
