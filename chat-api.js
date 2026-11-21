// ---------------------------------------------------------------
// CendurOFF Komunita – skupinový chat (v4.63)
// Jedna společná místnost, píšou a čtou jen přihlášení členové. Vlastní zprávu smaže autor, jakoukoli admin.
//   GET    /api/chat?after=<id>   – posledních 100 zpráv (nebo jen novější než id)
//   POST   /api/chat              – { text } (1–1000 znaků)
//   DELETE /api/chat/:id
// ---------------------------------------------------------------
const MAX_LEN = 1000;
const KEEP = 3000;                 // starší zprávy se občas mažou
const PER_MIN = 15;                // nejvýš zpráv za minutu od jednoho člena

function mount(app, { pool, requireAuth, isAdmin, atLeast }) {
  let ready = null;
  function ensure() {
    if (!ready) {
      ready = pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          text TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`).catch(err => { ready = null; console.error('Chat: tabulku se nepodařilo založit:', err); throw err; });
    }
    return ready;
  }
  (app.locals.cendurSchemas = app.locals.cendurSchemas || []).push(() => ensure());
  const whenReady = (req, res, next) => ensure().then(() => next(), () => res.status(500).json({ error: 'Chat není připravený.' }));

  const hits = new Map();   // user_id -> [časy]
  const SELECT = `SELECT m.id, m.user_id, m.text, m.created_at, u.display_name AS nick, u.role
                  FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id`;

  app.get('/api/chat', whenReady, requireAuth, async (req, res) => {
    try {
      const after = Number(req.query.after);
      const r = Number.isFinite(after) && after > 0
        ? await pool.query(SELECT + ' WHERE m.id > $1 ORDER BY m.id ASC LIMIT 200', [after])
        : await pool.query('SELECT * FROM (' + SELECT + ' ORDER BY m.id DESC LIMIT 100) t ORDER BY id ASC');
      res.json(r.rows);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Chat se nepodařilo načíst.' }); }
  });

  app.post('/api/chat', whenReady, requireAuth, async (req, res) => {
    try {
      const text = String((req.body && req.body.text) || '').replace(/\r\n/g, '\n').trim();
      if (!text) return res.status(400).json({ error: 'Napiš nějakou zprávu.' });
      if (text.length > MAX_LEN) return res.status(400).json({ error: 'Zpráva může mít nejvýš ' + MAX_LEN + ' znaků.' });
      const now = Date.now();
      const list = (hits.get(req.user.id) || []).filter(t => now - t < 60000);
      if (list.length >= PER_MIN) return res.status(429).json({ error: 'Píšeš moc rychle, chvilku počkej.' });
      list.push(now); hits.set(req.user.id, list);
      if (hits.size > 5000) hits.clear();
      const ins = await pool.query('INSERT INTO chat_messages (user_id, text) VALUES ($1, $2) RETURNING id', [req.user.id, text]);
      if (Math.random() < 0.02) pool.query('DELETE FROM chat_messages WHERE id < (SELECT MIN(id) FROM (SELECT id FROM chat_messages ORDER BY id DESC LIMIT $1) k)', [KEEP]).catch(() => {});
      const r = await pool.query(SELECT + ' WHERE m.id = $1', [ins.rows[0].id]);
      res.status(201).json(r.rows[0]);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Zprávu se nepodařilo odeslat.' }); }
  });

  app.delete('/api/chat/:id', whenReady, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = atLeast(req, 'moderator')
        ? await pool.query('DELETE FROM chat_messages WHERE id = $1 RETURNING id', [id])
        : await pool.query('DELETE FROM chat_messages WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Zpráva nenalezena (nebo není tvoje).' });
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Zprávu se nepodařilo smazat.' }); }
  });
}

module.exports = { mount };
