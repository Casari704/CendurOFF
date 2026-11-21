// ---------------------------------------------------------------
// CendurOFF Komunita – články (v4.64)
//   kind 'aktuality'   – krátké zprávy, píše jen admin
//   kind 'fotoreporty' – články z výletů, píše admin a členové, kterým to admin povolí (users.can_report)
// Čtení je veřejné. Fotky se ukládají jako obrázky (bytea) a posílají se zvlášť (GET /api/posts/photo/:id),
// takže seznam článků je malý a fotky se stahují až když jsou vidět.
//   GET    /api/posts?kind=…&before=<id>   – 10 článků, nejnovější první
//   GET    /api/posts/photo/:id            – obrázek
//   GET    /api/posts/perm                 – co smí přihlášený psát
//   POST   /api/posts                      – { kind, title, text, photos:[data:image/...;base64,...] }
//   PUT    /api/posts/:id                  – { title, text }  (autor nebo admin)
//   DELETE /api/posts/:id                  – autor nebo admin
// ---------------------------------------------------------------
const { detectImageType } = require('./security');

const KINDS = ['aktuality', 'fotoreporty'];
const MAX_PHOTOS = { aktuality: 4, fotoreporty: 12 };
const MAX_PHOTO_BYTES = 1500000;
const MAX_TITLE = 120, MAX_TEXT = 8000;
const PAGE = 10;
const DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;

function mount(app, { pool, requireAuth, optionalAuth, isAdmin }) {
  let ready = null;
  function ensure() {
    if (!ready) {
      ready = (async () => {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_report BOOLEAN NOT NULL DEFAULT false`);
        await pool.query(`CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          kind TEXT NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_kind ON posts(kind, id DESC)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS post_photos (
          id SERIAL PRIMARY KEY,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          pos INTEGER NOT NULL DEFAULT 0,
          mime TEXT NOT NULL,
          data BYTEA NOT NULL
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_post_photos_post ON post_photos(post_id, pos)`);
      })().catch(err => { ready = null; console.error('Články: tabulky se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  (app.locals.cendurSchemas = app.locals.cendurSchemas || []).push(() => ensure());
  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Články nejsou připravené.' }));

  async function canWrite(req, kind) {
    if (isAdmin(req)) return true;
    if (kind !== 'fotoreporty') return false;
    const r = await pool.query('SELECT can_report FROM users WHERE id = $1', [req.user.id]);
    return !!(r.rows[0] && r.rows[0].can_report);
  }
  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim().slice(0, n);

  app.get('/api/posts/perm', whenReady, requireAuth, async (req, res) => {
    try {
      res.json({ aktuality: await canWrite(req, 'aktuality'), fotoreporty: await canWrite(req, 'fotoreporty') });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Oprávnění se nepodařilo zjistit.' }); }
  });

  app.get('/api/posts', whenReady, async (req, res) => {
    try {
      const kind = String(req.query.kind || '');
      if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Neznámá kategorie.' });
      const before = Number(req.query.before);
      const r = await pool.query(
        `SELECT p.id, p.kind, p.title, p.body AS text, p.created_at, p.updated_at, p.user_id, u.display_name AS nick, u.role,
                COALESCE((SELECT json_agg(ph.id ORDER BY ph.pos, ph.id) FROM post_photos ph WHERE ph.post_id = p.id), '[]'::json) AS photos
         FROM posts p LEFT JOIN users u ON u.id = p.user_id
         WHERE p.kind = $1 ${Number.isFinite(before) && before > 0 ? 'AND p.id < $3' : ''}
         ORDER BY p.id DESC LIMIT $2`,
        Number.isFinite(before) && before > 0 ? [kind, PAGE + 1, before] : [kind, PAGE + 1]);
      const more = r.rows.length > PAGE;
      res.json({ posts: r.rows.slice(0, PAGE), more });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Články se nepodařilo načíst.' }); }
  });

  app.get('/api/posts/photo/:id', whenReady, async (req, res) => {
    try {
      const r = await pool.query('SELECT mime, data FROM post_photos WHERE id = $1', [Number(req.params.id)]);
      if (!r.rows[0]) return res.status(404).end();
      res.set({ 'Content-Type': r.rows[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
      res.send(r.rows[0].data);
    } catch (e) { console.error(e); res.status(500).end(); }
  });

  app.post('/api/posts', whenReady, requireAuth, async (req, res) => {
    try {
      const b = req.body || {};
      const kind = String(b.kind || '');
      if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Neznámá kategorie.' });
      if (!(await canWrite(req, kind))) return res.status(403).json({ error: kind === 'aktuality' ? 'Aktuality přidává jen admin.' : 'Fotoreportáže smí přidávat jen vybraní členové.' });
      const title = clean(b.title, MAX_TITLE), text = clean(b.text, MAX_TEXT);
      if (title.length < 3) return res.status(400).json({ error: 'Napiš nadpis (aspoň 3 znaky).' });
      if (!text) return res.status(400).json({ error: 'Napiš text článku.' });
      const photos = Array.isArray(b.photos) ? b.photos : [];
      if (photos.length > MAX_PHOTOS[kind]) return res.status(400).json({ error: 'Nejvýš ' + MAX_PHOTOS[kind] + ' fotek.' });
      const bufs = [];
      for (const d of photos) {
        const m = DATA_URL.exec(String(d));
        if (!m) return res.status(400).json({ error: 'Fotka není platný obrázek.' });
        const buf = Buffer.from(m[2], 'base64');
        const type = detectImageType(buf);
        if (!type) return res.status(400).json({ error: 'Fotka není platný obrázek.' });
        if (buf.length > MAX_PHOTO_BYTES) return res.status(400).json({ error: 'Fotka je příliš velká (nejvýš 1,5 MB).' });
        bufs.push({ type, buf });
      }
      const ins = await pool.query('INSERT INTO posts (kind, user_id, title, body) VALUES ($1,$2,$3,$4) RETURNING id', [kind, req.user.id, title, text]);
      const id = ins.rows[0].id;
      for (let i = 0; i < bufs.length; i++) {
        await pool.query('INSERT INTO post_photos (post_id, pos, mime, data) VALUES ($1,$2,$3,$4)', [id, i, bufs[i].type, bufs[i].buf]);
      }
      res.status(201).json({ id });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Článek se nepodařilo uložit.' }); }
  });

  async function ownPost(req, res) {
    const r = await pool.query('SELECT id, user_id FROM posts WHERE id = $1', [Number(req.params.id)]);
    const p = r.rows[0];
    if (!p) { res.status(404).json({ error: 'Článek nenalezen.' }); return null; }
    if (!isAdmin(req) && p.user_id !== req.user.id) { res.status(403).json({ error: 'Cizí článek může upravit jen admin.' }); return null; }
    return p;
  }
  app.put('/api/posts/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const p = await ownPost(req, res); if (!p) return;
      const title = clean(req.body && req.body.title, MAX_TITLE), text = clean(req.body && req.body.text, MAX_TEXT);
      if (title.length < 3 || !text) return res.status(400).json({ error: 'Nadpis i text musí být vyplněné.' });
      await pool.query('UPDATE posts SET title = $2, body = $3, updated_at = now() WHERE id = $1', [p.id, title, text]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Článek se nepodařilo upravit.' }); }
  });
  app.delete('/api/posts/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const p = await ownPost(req, res); if (!p) return;
      await pool.query('DELETE FROM posts WHERE id = $1', [p.id]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Článek se nepodařilo smazat.' }); }
  });
}

module.exports = { mount };
