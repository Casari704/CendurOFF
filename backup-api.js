// ---------------------------------------------------------------
// CendurOFF – záloha a obnova databáze (v4.16)
//
//  GET  /api/admin/backup            → celá databáze jako .json.gz (jen admin)
//  POST /api/admin/restore?confirm=OBNOVIT  (tělo = ten soubor .json.gz)
//                                    → vše v jedné transakci: buď se obnoví všechno, nebo nic
//
// Do server.js se připojuje jedním řádkem (až po ostatních modulech):
//   require('./backup-api').mount(app, { pool, requireAuth, isAdmin });
// Moduly s vlastními tabulkami se zapisují do app.locals.cendurSchemas – před obnovou se
// tabulky založí, i kdyby databáze byla úplně nová.
// ---------------------------------------------------------------
const zlib = require('zlib');
const express = require('express');

const FORMAT = 1;
const SKIP = new Set(['region_cache']);   // CHKO a benzínky si server stáhne sám znovu
const qi = n => '"' + String(n).replace(/"/g, '""') + '"';

async function tableList(db){
  const r = await db.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
  return r.rows.map(x => x.table_name).filter(n => !SKIP.has(n));
}
async function columnsOf(db, t){
  const r = await db.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [t]);
  return r.rows.map(x => ({ name: x.column_name, type: x.data_type }));
}
// pořadí podle cizích klíčů: nejdřív tabulky, na které ostatní odkazují (users před routes…)
async function fkOrder(db, tables){
  const r = await db.query(`SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'`);
  const strip = s => s.replace(/^public\./, '').replace(/^"|"$/g, '');
  const deps = new Map(tables.map(t => [t, new Set()]));
  r.rows.forEach(x => { const c = strip(x.child), p = strip(x.parent); if(c !== p && deps.has(c) && deps.has(p)) deps.get(c).add(p); });
  const out = [], seen = new Set();
  const visit = (t, path) => { if(seen.has(t)) return; if(path.has(t)) return; path.add(t); deps.get(t).forEach(p => visit(p, path)); path.delete(t); seen.add(t); out.push(t); };
  tables.forEach(t => visit(t, new Set()));
  return out;
}

function mount(app, { pool, requireAuth, isAdmin }){
  const onlyAdmin = (req, res, next) => isAdmin(req) ? next() : res.status(403).json({ error: 'Jen pro admina.' });

  app.get('/api/admin/backup', requireAuth, onlyAdmin, async (req, res) => {
    const db = await pool.connect();
    try{
      // jeden snímek: všechny tabulky ve stejném okamžiku
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const tables = await tableList(db), out = {};
      for(const t of tables){
        const cols = await columnsOf(db, t);
        const r = await db.query({ text: 'SELECT ' + cols.map(c => qi(c.name)).join(',') + ' FROM ' + qi(t), rowMode: 'array' });
        out[t] = { columns: cols, rows: r.rows };
      }
      await db.query('COMMIT');
      const body = JSON.stringify({ app: 'CendurOFF', format: FORMAT, created: new Date().toISOString(), tables: out });
      const gz = zlib.gzipSync(Buffer.from(body, 'utf8'));
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
      res.set('Content-Type', 'application/gzip');
      res.set('Content-Disposition', 'attachment; filename="cenduroff-zaloha-' + stamp + '.json.gz"');
      res.set('X-Backup-Counts', encodeURIComponent(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.rows.length])))));
      res.set('Access-Control-Expose-Headers', 'X-Backup-Counts, Content-Disposition');
      res.send(gz);
    }catch(e){
      try{ await db.query('ROLLBACK'); }catch(_){}
      console.error('Záloha selhala:', e);
      res.status(500).json({ error: 'Zálohu se nepodařilo vytvořit.' });
    }finally{ db.release(); }
  });

  app.post('/api/admin/restore', requireAuth, onlyAdmin,
    express.raw({ type: () => true, limit: '1gb' }),
    async (req, res) => {
      if(req.query.confirm !== 'OBNOVIT') return res.status(400).json({ error: 'Chybí potvrzení obnovy.' });
      let data;
      try{
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
        const txt = (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
        data = JSON.parse(txt);
      }catch(e){ return res.status(400).json({ error: 'Soubor není záloha CendurOFF (nejde přečíst).' }); }
      if(!data || data.app !== 'CendurOFF' || data.format !== FORMAT || !data.tables) return res.status(400).json({ error: 'Soubor není záloha CendurOFF.' });

      // tabulky modulů (roadbooky, profil, admin…) založit, kdyby databáze byla nová
      for(const ens of (app.locals.cendurSchemas || [])){ try{ await ens(); }catch(e){} }

      const db = await pool.connect();
      const counts = {}, skipped = [];
      try{
        await db.query('BEGIN');
        const live = new Set(await tableList(db));
        const names = Object.keys(data.tables).filter(t => { if(live.has(t)) return true; skipped.push(t + ' (tabulka chybí)'); return false; });
        const order = await fkOrder(db, names);
        // smazat jen tabulky ze zálohy (CASCADE kvůli vazbám), čísla id se nastaví níž
        if(order.length) await db.query('TRUNCATE ' + order.map(qi).join(',') + ' CASCADE');
        for(const t of order){
          const src = data.tables[t], liveCols = await columnsOf(db, t);
          const liveMap = new Map(liveCols.map(c => [c.name, c.type]));
          const idx = [], cols = [];
          src.columns.forEach((c, i) => { if(liveMap.has(c.name)){ idx.push(i); cols.push(c.name); } else skipped.push(t + '.' + c.name); });
          const isJson = cols.map(n => /json/.test(liveMap.get(n)));
          const per = Math.max(1, Math.min(500, Math.floor(60000 / Math.max(1, cols.length))));
          for(let s = 0; s < src.rows.length; s += per){
            const chunk = src.rows.slice(s, s + per), params = [], tuples = [];
            chunk.forEach(row => {
              tuples.push('(' + idx.map((ci, k) => {
                let v = row[ci];
                if(v != null && isJson[k]) v = JSON.stringify(v);
                params.push(v); return '$' + params.length;
              }).join(',') + ')');
            });
            if(cols.length) await db.query('INSERT INTO ' + qi(t) + ' (' + cols.map(qi).join(',') + ') VALUES ' + tuples.join(','), params);
          }
          counts[t] = src.rows.length;
          // počítadla id (SERIAL) posunout za nejvyšší obnovené id
          for(const c of liveCols){
            const sq = await db.query('SELECT pg_get_serial_sequence($1, $2) AS s', [qi(t), c.name]);
            const seq = sq.rows[0] && sq.rows[0].s;
            if(seq) await db.query('SELECT setval($1, COALESCE((SELECT MAX(' + qi(c.name) + ') FROM ' + qi(t) + '), 0) + 1, false)', [seq]);
          }
        }
        await db.query('COMMIT');
        res.json({ ok: true, created: data.created, counts, skipped });
      }catch(e){
        try{ await db.query('ROLLBACK'); }catch(_){}
        console.error('Obnova selhala:', e);
        res.status(500).json({ error: 'Obnova selhala, databáze zůstala beze změny. (' + e.message + ')' });
      }finally{ db.release(); }
    });
}

module.exports = { mount };
