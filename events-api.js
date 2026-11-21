// ---------------------------------------------------------------
// CendurOFF Komunita – Srazy (v4.69)
// Sraz = kdy, kde, popis, volitelně odkaz a jedna fotka; členové potvrzují účast.
// Čtení je veřejné, přidávat smí každý přihlášený, upravit/smazat autor nebo moderátor.
//   GET    /api/events                    – nadcházející (a ty, co právě běží; do 6 h po začátku)
//   GET    /api/events?past=1&offset=N    – proběhlé, 10 na stránku, nejnovější první
//   GET    /api/events/photo/:id          – fotka
//   GET    /api/events/:id/going          – kdo se zúčastní (přezdívky)
//   POST   /api/events                    – { title, startsAt, place, description, url, photo(data URL) }
//   PUT    /api/events/:id                – { title, startsAt, place, description, url }
//   DELETE /api/events/:id
//   POST   /api/events/:id/join, DELETE /api/events/:id/join – potvrdit / zrušit účast
// ---------------------------------------------------------------
const { detectImageType } = require('./security');

const MAX_PHOTO_BYTES = 1500000;
const DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;
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
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_start ON events(starts_at)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS event_rsvps (
          event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (event_id, user_id)
        )`);
      })().catch(err => { ready = null; console.error('Srazy: tabulky se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  (app.locals.cendurSchemas = app.locals.cendurSchemas || []).push(() => ensure());
  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Srazy nejsou připravené.' }));

  const clean = (s, n) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim().slice(0, n);
  const SELECT = `SELECT e.id, e.title, e.starts_at, e.place, e.description, e.url, e.user_id, (e.photo_mime IS NOT NULL) AS has_photo,
                         u.display_name AS nick, u.role,
                         (SELECT COUNT(*)::int FROM event_rsvps r WHERE r.event_id = e.id) AS going,
                         EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = $1) AS joined
                  FROM events e LEFT JOIN users u ON u.id = e.user_id`;

  function parse(b) {
    const title = clean(b.title, 120), place = clean(b.place, 160), description = clean(b.description, 2000);
    if (title.length < 3) return { error: 'Napiš název srazu (aspoň 3 znaky).' };
    if (place.length < 2) return { error: 'Napiš, kde se sraz koná.' };
    const t = new Date(b.startsAt);
    if (isNaN(t.getTime())) return { error: 'Zadej datum a čas.' };
    const now = Date.now();
    if (t.getTime() < now - 24 * 3600 * 1000) return { error: 'Datum je v minulosti.' };
    if (t.getTime() > now + 800 * 24 * 3600 * 1000) return { error: 'Datum je příliš daleko.' };
    let url = clean(b.url, 300);
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; url = u.toString(); } catch (e) { return { error: 'Odkaz není platná adresa.' }; }
    }
    return { v: { title, place, description, url: url || null, startsAt: t.toISOString() } };
  }

  app.get('/api/events', whenReady, optionalAuth, async (req, res) => {
    try {
      const uid = req.user ? req.user.id : 0;
      if (req.query.past) {
        const off = Math.max(0, Math.floor(Number(req.query.offset)) || 0);
        const r = await pool.query(SELECT + ` WHERE e.starts_at < now() - interval '6 hours' ORDER BY e.starts_at DESC, e.id DESC LIMIT ${PAGE + 1} OFFSET ${off}`, [uid]);
        return res.json({ events: r.rows.slice(0, PAGE), more: r.rows.length > PAGE });
      }
      const r = await pool.query(SELECT + ` WHERE e.starts_at >= now() - interval '6 hours' ORDER BY e.starts_at ASC, e.id ASC LIMIT 100`, [uid]);
      res.json({ events: r.rows, more: false });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Srazy se nepodařilo načíst.' }); }
  });

  app.get('/api/events/photo/:id', whenReady, async (req, res) => {
    try {
      const r = await pool.query('SELECT photo_mime AS mime, photo AS data FROM events WHERE id = $1 AND photo IS NOT NULL', [Number(req.params.id)]);
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
      let mime = null, buf = null;
      const d = req.body.photo;
      if (d) {
        const m = DATA_URL.exec(String(d));
        if (!m) return res.status(400).json({ error: 'Fotka není platný obrázek.' });
        buf = Buffer.from(m[2], 'base64');
        mime = detectImageType(buf);
        if (!mime) return res.status(400).json({ error: 'Fotka není platný obrázek.' });
        if (buf.length > MAX_PHOTO_BYTES) return res.status(400).json({ error: 'Fotka je příliš velká (nejvýš 1,5 MB).' });
      }
      const now = Date.now();
      const list = (hits.get(req.user.id) || []).filter(t => now - t < 3600000);
      if (list.length >= 5) return res.status(429).json({ error: 'Přidáváš moc srazů, zkus to později.' });
      list.push(now); hits.set(req.user.id, list);
      if (hits.size > 5000) hits.clear();
      const ins = await pool.query(
        'INSERT INTO events (user_id, title, starts_at, place, description, url, photo_mime, photo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [req.user.id, p.v.title, p.v.startsAt, p.v.place, p.v.description, p.v.url, mime, buf]);
      res.status(201).json({ id: ins.rows[0].id });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Sraz se nepodařilo uložit.' }); }
  });

  async function own(req, res) {
    const r = await pool.query('SELECT id, user_id FROM events WHERE id = $1', [Number(req.params.id)]);
    const ev = r.rows[0];
    if (!ev) { res.status(404).json({ error: 'Sraz nenalezen.' }); return null; }
    if (!atLeast(req, 'moderator') && ev.user_id !== req.user.id) { res.status(403).json({ error: 'Cizí sraz může upravit jen moderátor nebo admin.' }); return null; }
    return ev;
  }
  app.put('/api/events/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const ev = await own(req, res); if (!ev) return;
      const b = req.body || {};
      const p = parse(b); if (p.error) return res.status(400).json({ error: p.error });
      await pool.query('UPDATE events SET title=$2, starts_at=$3, place=$4, description=$5, url=$6 WHERE id=$1', [ev.id, p.v.title, p.v.startsAt, p.v.place, p.v.description, p.v.url]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Sraz se nepodařilo upravit.' }); }
  });
  app.delete('/api/events/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const ev = await own(req, res); if (!ev) return;
      await pool.query('DELETE FROM events WHERE id = $1', [ev.id]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Sraz se nepodařilo smazat.' }); }
  });

  app.post('/api/events/:id/join', whenReady, requireAuth, async (req, res) => {
    try {
      const ev = await pool.query('SELECT id FROM events WHERE id = $1', [Number(req.params.id)]);
      if (!ev.rows[0]) return res.status(404).json({ error: 'Sraz nenalezen.' });
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
