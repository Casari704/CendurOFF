// ---------------------------------------------------------------
// CendurOFF Komunita – Místa (v4.70): zajímavá místa (POI) s fotkami a komentáři
// Čtení je veřejné, přidávat a komentovat smí každý přihlášený, upravit/smazat autor nebo moderátor.
//   GET    /api/places?cat=&before=<id>   – 10 míst, nejnovější první (cat = kategorie, volitelně)
//   GET    /api/places/photo/:id          – fotka
//   GET    /api/places/:id/comments       – komentáře
//   POST   /api/places                    – { name, category, locality, lat, lon, description, url, photos:[data URL] }
//   PUT    /api/places/:id                – stejná pole kromě fotek
//   DELETE /api/places/:id
//   POST   /api/places/:id/comments       – { text }
//   DELETE /api/places/comments/:cid
// ---------------------------------------------------------------
const { detectImageType } = require('./security');

const CATS = ['vyhlidka', 'obcerstveni', 'terenni', 'pamatka', 'priroda', 'opustene', 'ostatni'];
const MAX_PHOTOS = 4, MAX_PHOTO_BYTES = 1500000, PAGE = 10;
const DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;

function mount(app, { pool, requireAuth, atLeast }) {
  let ready = null;
  function ensure() {
    if (!ready) {
      ready = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS places (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'ostatni',
          locality TEXT NOT NULL DEFAULT '',
          lat DOUBLE PRECISION,
          lon DOUBLE PRECISION,
          description TEXT NOT NULL DEFAULT '',
          url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_places_cat ON places(category, id DESC)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS place_photos (
          id SERIAL PRIMARY KEY,
          place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
          pos INTEGER NOT NULL DEFAULT 0,
          mime TEXT NOT NULL,
          data BYTEA NOT NULL
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_place_photos_place ON place_photos(place_id, pos)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS place_comments (
          id SERIAL PRIMARY KEY,
          place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          text TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_place_comments_place ON place_comments(place_id, id)`);
      })().catch(err => { ready = null; console.error('Místa: tabulky se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  (app.locals.cendurSchemas = app.locals.cendurSchemas || []).push(() => ensure());
  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Místa nejsou připravená.' }));
  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim().slice(0, n);

  function parse(b) {
    const name = clean(b.name, 120), locality = clean(b.locality, 160), description = clean(b.description, 3000);
    const category = CATS.includes(b.category) ? b.category : 'ostatni';
    if (name.length < 3) return { error: 'Napiš název místa (aspoň 3 znaky).' };
    let lat = null, lon = null;
    if (b.lat !== '' && b.lat != null || b.lon !== '' && b.lon != null) {
      lat = Number(b.lat); lon = Number(b.lon);
      if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: 'Souřadnice nejsou platné (např. 50.5123, 15.4321).' };
    }
    if (!locality && lat == null) return { error: 'Napiš, kde to je (obec, oblast), nebo zadej souřadnice.' };
    let url = clean(b.url, 300);
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; url = u.toString(); } catch (e) { return { error: 'Odkaz není platná adresa.' }; }
    }
    return { v: { name, category, locality, lat, lon, description, url: url || null } };
  }

  app.get('/api/places', whenReady, async (req, res) => {
    try {
      const cat = String(req.query.cat || ''), before = Number(req.query.before);
      const args = [PAGE + 1]; let where = [];
      if (CATS.includes(cat)) { args.push(cat); where.push('p.category = $' + args.length); }
      if (Number.isFinite(before) && before > 0) { args.push(before); where.push('p.id < $' + args.length); }
      const r = await pool.query(
        `SELECT p.id, p.name, p.category, p.locality, p.lat, p.lon, p.description, p.url, p.created_at, p.user_id, u.display_name AS nick, u.role,
                COALESCE((SELECT json_agg(ph.id ORDER BY ph.pos, ph.id) FROM place_photos ph WHERE ph.place_id = p.id), '[]'::json) AS photos,
                (SELECT COUNT(*)::int FROM place_comments c WHERE c.place_id = p.id) AS comments
         FROM places p LEFT JOIN users u ON u.id = p.user_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC LIMIT $1`, args);
      res.json({ places: r.rows.slice(0, PAGE), more: r.rows.length > PAGE });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Místa se nepodařilo načíst.' }); }
  });

  app.get('/api/places/photo/:id', whenReady, async (req, res) => {
    try {
      const r = await pool.query('SELECT mime, data FROM place_photos WHERE id = $1', [Number(req.params.id)]);
      if (!r.rows[0]) return res.status(404).end();
      res.set({ 'Content-Type': r.rows[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
      res.send(r.rows[0].data);
    } catch (e) { console.error(e); res.status(500).end(); }
  });

  const hits = new Map();   // user_id -> časy přidání místa (5 za hodinu)
  app.post('/api/places', whenReady, requireAuth, async (req, res) => {
    try {
      const b = req.body || {};
      const p = parse(b); if (p.error) return res.status(400).json({ error: p.error });
      const photos = Array.isArray(b.photos) ? b.photos : [];
      if (photos.length > MAX_PHOTOS) return res.status(400).json({ error: 'Nejvýš ' + MAX_PHOTOS + ' fotky.' });
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
      const now = Date.now();
      const list = (hits.get(req.user.id) || []).filter(t => now - t < 3600000);
      if (list.length >= 5) return res.status(429).json({ error: 'Přidáváš moc míst, zkus to později.' });
      list.push(now); hits.set(req.user.id, list);
      if (hits.size > 5000) hits.clear();
      const v = p.v;
      const ins = await pool.query('INSERT INTO places (user_id, name, category, locality, lat, lon, description, url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [req.user.id, v.name, v.category, v.locality, v.lat, v.lon, v.description, v.url]);
      for (let i = 0; i < bufs.length; i++) await pool.query('INSERT INTO place_photos (place_id, pos, mime, data) VALUES ($1,$2,$3,$4)', [ins.rows[0].id, i, bufs[i].type, bufs[i].buf]);
      res.status(201).json({ id: ins.rows[0].id });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Místo se nepodařilo uložit.' }); }
  });

  async function own(req, res) {
    const r = await pool.query('SELECT id, user_id FROM places WHERE id = $1', [Number(req.params.id)]);
    const pl = r.rows[0];
    if (!pl) { res.status(404).json({ error: 'Místo nenalezeno.' }); return null; }
    if (!atLeast(req, 'moderator') && pl.user_id !== req.user.id) { res.status(403).json({ error: 'Cizí místo může upravit jen moderátor nebo admin.' }); return null; }
    return pl;
  }
  app.put('/api/places/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const pl = await own(req, res); if (!pl) return;
      const p = parse(req.body || {}); if (p.error) return res.status(400).json({ error: p.error });
      const v = p.v;
      await pool.query('UPDATE places SET name=$2, category=$3, locality=$4, lat=$5, lon=$6, description=$7, url=$8 WHERE id=$1', [pl.id, v.name, v.category, v.locality, v.lat, v.lon, v.description, v.url]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Místo se nepodařilo upravit.' }); }
  });
  app.delete('/api/places/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const pl = await own(req, res); if (!pl) return;
      await pool.query('DELETE FROM places WHERE id = $1', [pl.id]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Místo se nepodařilo smazat.' }); }
  });

  // ---------- komentáře ----------
  const chits = new Map();
  const CSEL = `SELECT c.id, c.place_id, c.user_id, c.text, c.created_at, u.display_name AS nick, u.role
                FROM place_comments c LEFT JOIN users u ON u.id = c.user_id`;
  app.get('/api/places/:id/comments', whenReady, async (req, res) => {
    try {
      const r = await pool.query(CSEL + ' WHERE c.place_id = $1 ORDER BY c.id ASC LIMIT 300', [Number(req.params.id)]);
      res.json(r.rows);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Komentáře se nepodařilo načíst.' }); }
  });
  app.post('/api/places/:id/comments', whenReady, requireAuth, async (req, res) => {
    try {
      const text = String((req.body && req.body.text) || '').replace(/\r\n/g, '\n').trim();
      if (!text) return res.status(400).json({ error: 'Napiš komentář.' });
      if (text.length > 1000) return res.status(400).json({ error: 'Komentář může mít nejvýš 1000 znaků.' });
      const now = Date.now();
      const list = (chits.get(req.user.id) || []).filter(t => now - t < 60000);
      if (list.length >= 6) return res.status(429).json({ error: 'Píšeš moc rychle, chvilku počkej.' });
      list.push(now); chits.set(req.user.id, list);
      if (chits.size > 5000) chits.clear();
      const pl = await pool.query('SELECT id FROM places WHERE id = $1', [Number(req.params.id)]);
      if (!pl.rows[0]) return res.status(404).json({ error: 'Místo nenalezeno.' });
      const ins = await pool.query('INSERT INTO place_comments (place_id, user_id, text) VALUES ($1,$2,$3) RETURNING id', [pl.rows[0].id, req.user.id, text]);
      const r = await pool.query(CSEL + ' WHERE c.id = $1', [ins.rows[0].id]);
      res.status(201).json(r.rows[0]);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Komentář se nepodařilo uložit.' }); }
  });
  app.delete('/api/places/comments/:cid', whenReady, requireAuth, async (req, res) => {
    try {
      const r = atLeast(req, 'moderator')
        ? await pool.query('DELETE FROM place_comments WHERE id = $1 RETURNING id', [Number(req.params.cid)])
        : await pool.query('DELETE FROM place_comments WHERE id = $1 AND user_id = $2 RETURNING id', [Number(req.params.cid), req.user.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Komentář nenalezen (nebo není tvůj).' });
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Komentář se nepodařilo smazat.' }); }
  });
}

module.exports = { mount };
