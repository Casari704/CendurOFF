// ---------------------------------------------------------------
// CendurOFF Komunita – Akce (v4.69)
// Akce (sraz, vyjížďka…) = kdy, kde, popis, volitelně odkaz a až 3 fotky (první je hlavní); členové potvrzují účast.
// Čtení je veřejné, přidávat smí každý přihlášený, upravit/smazat autor nebo moderátor.
//   GET    /api/events                    – nadcházející akce (a ty, co právě probíhají)
//   GET    /api/events?past=1&offset=N    – proběhlé, 10 na stránku, nejnovější první
//   GET    /api/events/photo/:id          – fotka (id fotky)
//   GET    /api/events/:id/going          – kdo se zúčastní (přezdívky)
//   POST   /api/events                    – { title, dateFrom, dateTo (volitelné), place, description, url, photos:[data URL ×3] }
//   PUT    /api/events/:id                – { title, dateFrom, dateTo, place, description, url, keep:[id fotek], photos:[nové] }
//   DELETE /api/events/:id
//   POST   /api/events/:id/join, DELETE /api/events/:id/join – potvrdit / zrušit účast
// ---------------------------------------------------------------
const { decodePhotos, syncPhotos } = require('./photo-util');

const MAX_PHOTOS = 3;
const PAGE = 10;

function mount(app, { pool, requireAuth, optionalAuth, atLeast }) {
  let ready = null;
  function ensure() {
    if (!ready) {
      ready = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          starts_at TIMESTAMPTZ NOT NULL,
          place TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          url TEXT,
          photo_mime TEXT,
          photo BYTEA,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
        // v4.71: akce má termín od–do (jen dny, bez času); starts_at zůstává jen u starších záznamů
        await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS date_from DATE`);
        await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS date_to DATE`);
        await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_at TIMESTAMPTZ`);   // kvůli výměně fotky (cache prohlížeče)
        await pool.query(`ALTER TABLE events ALTER COLUMN starts_at DROP NOT NULL`);
        await pool.query(`UPDATE events SET date_from = (starts_at AT TIME ZONE 'Europe/Prague')::date, date_to = (starts_at AT TIME ZONE 'Europe/Prague')::date WHERE date_from IS NULL AND starts_at IS NOT NULL`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_from ON events(date_from)`);
        // v4.77: až 3 fotky u akce; dřívější jediná fotka se jednorázově přesune do event_photos
        await pool.query(`CREATE TABLE IF NOT EXISTS event_photos (
          id SERIAL PRIMARY KEY,
          event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          pos INTEGER NOT NULL DEFAULT 0,
          mime TEXT NOT NULL,
          data BYTEA NOT NULL
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id)`);
        await pool.query(`WITH old AS (SELECT id, photo_mime, photo FROM events WHERE photo IS NOT NULL),
          ins AS (INSERT INTO event_photos (event_id, pos, mime, data) SELECT id, 0, photo_mime, photo FROM old)
          UPDATE events SET photo = NULL, photo_mime = NULL WHERE id IN (SELECT id FROM old)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS event_rsvps (
          event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (event_id, user_id)
        )`);
      })().catch(err => { ready = null; console.error('Akce: tabulky se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  (app.locals.cendurSchemas = app.locals.cendurSchemas || []).push(() => ensure());
  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Akce nejsou připravené.' }));

  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim().slice(0, n);
  const SELECT = `SELECT e.id, e.title, e.date_from::text AS date_from, e.date_to::text AS date_to, e.place, e.description, e.url, e.user_id, ARRAY(SELECT p.id FROM event_photos p WHERE p.event_id = e.id ORDER BY p.pos, p.id) AS photos,
                         u.display_name AS nick, u.role,
                         (SELECT COUNT(*)::int FROM event_rsvps r WHERE r.event_id = e.id) AS going,
                         EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = $1) AS joined
                  FROM events e LEFT JOIN users u ON u.id = e.user_id`;

  function parse(b) {
    const title = clean(b.title, 120), place = clean(b.place, 160), description = clean(b.description, 2000);
    if (title.length < 3) return { error: 'Napiš název akce (aspoň 3 znaky).' };
    if (place.length < 2) return { error: 'Napiš, kde se akce koná.' };
    const day = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? { d, s: m[0] } : null; };
    const from = day(b.dateFrom), to = b.dateTo ? day(b.dateTo) : from;
    if (!from || !to) return { error: 'Zadej datum konání.' };
    if (to.d < from.d) return { error: 'Konec akce nemůže být před začátkem.' };
    const today = Date.now();
    if (to.d.getTime() < today - 2 * 24 * 3600 * 1000) return { error: 'Datum je v minulosti.' };
    if (from.d.getTime() > today + 800 * 24 * 3600 * 1000) return { error: 'Datum je příliš daleko.' };
    if ((to.d - from.d) / 86400000 > 60) return { error: 'Akce může trvat nejvýš 60 dní.' };
    let url = clean(b.url, 300);
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; url = u.toString(); } catch (e) { return { error: 'Odkaz není platná adresa.' }; }
    }
    return { v: { title, place, description, url: url || null, dateFrom: from.s, dateTo: to.s } };
  }

  app.get('/api/events', whenReady, optionalAuth, async (req, res) => {
    try {
      const uid = req.user ? req.user.id : 0;
      if (req.query.past) {
        const off = Math.max(0, Math.floor(Number(req.query.offset)) || 0);
        const r = await pool.query(SELECT + ` WHERE e.date_to < (now() AT TIME ZONE 'Europe/Prague')::date ORDER BY e.date_from DESC, e.id DESC LIMIT ${PAGE + 1} OFFSET ${off}`, [uid]);
        return res.json({ events: r.rows.slice(0, PAGE), more: r.rows.length > PAGE });
      }
      const r = await pool.query(SELECT + ` WHERE e.date_to >= (now() AT TIME ZONE 'Europe/Prague')::date ORDER BY e.date_from ASC, e.id ASC LIMIT 100`, [uid]);
      res.json({ events: r.rows, more: false });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Akce se nepodařilo načíst.' }); }
  });

  app.get('/api/events/photo/:id', whenReady, async (req, res) => {
    try {
      const r = await pool.query('SELECT mime, data FROM event_photos WHERE id = $1', [Number(req.params.id)]);
      if (!r.rows[0]) return res.status(404).end();
      res.set({ 'Content-Type': r.rows[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
      res.send(r.rows[0].data);
    } catch (e) { console.error(e); res.status(500).end(); }
  });

  app.get('/api/events/:id/going', whenReady, async (req, res) => {
    try {
      const r = await pool.query(`SELECT u.display_name AS nick FROM event_rsvps r JOIN users u ON u.id = r.user_id WHERE r.event_id = $1 ORDER BY r.created_at LIMIT 200`, [Number(req.params.id)]);
      res.json(r.rows.map(x => x.nick));
    } catch (e) { console.error(e); res.status(500).json({ error: 'Seznam se nepodařilo načíst.' }); }
  });

  const hits = new Map();   // user_id -> časy vytvoření srazů (omezení: 5 za hodinu)
  app.post('/api/events', whenReady, requireAuth, async (req, res) => {
    try {
      const p = parse(req.body || {}); if (p.error) return res.status(400).json({ error: p.error });
      const list0 = Array.isArray(req.body.photos) ? req.body.photos : [];
      if (list0.length > MAX_PHOTOS) return res.status(400).json({ error: 'Nejvýš ' + MAX_PHOTOS + ' fotky.' });
      const dec = decodePhotos(list0); if (dec.error) return res.status(400).json({ error: dec.error });
      const now = Date.now();
      const list = (hits.get(req.user.id) || []).filter(t => now - t < 3600000);
      if (list.length >= 5) return res.status(429).json({ error: 'Přidáváš moc akcí, zkus to později.' });
      list.push(now); hits.set(req.user.id, list);
      if (hits.size > 5000) hits.clear();
      const ins = await pool.query(
        'INSERT INTO events (user_id, title, date_from, date_to, place, description, url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [req.user.id, p.v.title, p.v.dateFrom, p.v.dateTo, p.v.place, p.v.description, p.v.url]);
      let pos = 0;
      for (const b of dec.bufs) await pool.query('INSERT INTO event_photos (event_id, pos, mime, data) VALUES ($1,$2,$3,$4)', [ins.rows[0].id, pos++, b.type, b.buf]);
      res.status(201).json({ id: ins.rows[0].id });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Akci se nepodařilo uložit.' }); }
  });

  async function own(req, res) {
    const r = await pool.query('SELECT id, user_id FROM events WHERE id = $1', [Number(req.params.id)]);
    const ev = r.rows[0];
    if (!ev) { res.status(404).json({ error: 'Akce nenalezena.' }); return null; }
    if (!atLeast(req, 'moderator') && ev.user_id !== req.user.id) { res.status(403).json({ error: 'Cizí akci může upravit jen moderátor nebo admin.' }); return null; }
    return ev;
  }
  app.put('/api/events/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const ev = await own(req, res); if (!ev) return;
      const b = req.body || {};
      const p = parse(b); if (p.error) return res.status(400).json({ error: p.error });
      const perr = await syncPhotos(pool, 'event_photos', 'event_id', ev.id, b, MAX_PHOTOS);
      if (perr) return res.status(400).json({ error: perr });
      await pool.query('UPDATE events SET title=$2, date_from=$3, date_to=$4, place=$5, description=$6, url=$7 WHERE id=$1', [ev.id, p.v.title, p.v.dateFrom, p.v.dateTo, p.v.place, p.v.description, p.v.url]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Akci se nepodařilo upravit.' }); }
  });
  app.delete('/api/events/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const ev = await own(req, res); if (!ev) return;
      await pool.query('DELETE FROM events WHERE id = $1', [ev.id]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Akci se nepodařilo smazat.' }); }
  });

  app.post('/api/events/:id/join', whenReady, requireAuth, async (req, res) => {
    try {
      const ev = await pool.query('SELECT id FROM events WHERE id = $1', [Number(req.params.id)]);
      if (!ev.rows[0]) return res.status(404).json({ error: 'Akce nenalezena.' });
      await pool.query('INSERT INTO event_rsvps (event_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [ev.rows[0].id, req.user.id]);
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM event_rsvps WHERE event_id = $1', [ev.rows[0].id]);
      res.json({ ok: true, going: c.rows[0].n, joined: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Účast se nepodařilo potvrdit.' }); }
  });
  app.delete('/api/events/:id/join', whenReady, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await pool.query('DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2', [id, req.user.id]);
      const c = await pool.query('SELECT COUNT(*)::int AS n FROM event_rsvps WHERE event_id = $1', [id]);
      res.json({ ok: true, going: c.rows[0].n, joined: false });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Účast se nepodařilo zrušit.' }); }
  });
}

module.exports = { mount };
