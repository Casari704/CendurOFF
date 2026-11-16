// ---------------------------------------------------------------
// CendurOFF – záloha a obnova databáze (v4.16)
//
//  GET  /api/admin/backup            → ZIP (jen admin): prehled.xlsx, gpx/, fotky/ a
//                                      zaloha-databaze.json.gz (celá databáze pro obnovu)  (v4.17)
//  POST /api/admin/restore?confirm=OBNOVIT  (tělo = ten ZIP, nebo jen soubor .json.gz)
//                                    → vše v jedné transakci: buď se obnoví všechno, nebo nic
//
// Do server.js se připojuje jedním řádkem (až po ostatních modulech):
//   require('./backup-api').mount(app, { pool, requireAuth, isAdmin });
// Moduly s vlastními tabulkami se zapisují do app.locals.cendurSchemas – před obnovou se
// tabulky založí, i kdyby databáze byla úplně nová.
// ---------------------------------------------------------------
const zlib = require('zlib');
const express = require('express');
const { zipBuild, zipRead, xlsxBuild } = require('./export-zip');

const FORMAT = 1;
const SKIP = new Set(['region_cache', 'route_terrain', 'osm_cell', 'route_osm', 'osm_roads']);   // mezipaměti z OpenStreetMap – server si je stáhne sám znovu
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

// ---------- čitelný export (v4.17) ----------
const safeName = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[. ]+$/, '') || 'bez nazvu';
const num = (v, d) => v == null || v === '' || isNaN(+v) ? null : Math.round(+v * Math.pow(10, d)) / Math.pow(10, d);
const dt = v => { if(!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
function objs(out, t){ const x = out[t]; if(!x) return []; const names = x.columns.map(c => c.name); return x.rows.map(r => Object.fromEntries(names.map((n, i) => [n, r[i]]))); }
function gpxOf(name, pts){
  const x = s => String(s || '').replace(/[<>&"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' }[c]));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CendurOFF" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>' + x(name) + '</name><trkseg>\n' +
    (pts || []).filter(p => Array.isArray(p) && p.length >= 2).map(p => '      <trkpt lat="' + p[0] + '" lon="' + p[1] + '">' + (p[2] != null ? '<ele>' + p[2] + '</ele>' : '') + '</trkpt>').join('\n') +
    '\n  </trkseg></trk>\n</gpx>\n';
}
const SRC = { atlas: 'Atlas NAVI', roadbook: 'Roadbook NAVI', record: 'záznam jízdy', gpx: 'nahraný GPX' };
const TYPES = { offroad: 'offroad', enduro: 'enduro', silnice: 'silnice', road: 'silnice' };
function buildExport(out, created, dbGz){
  const users = objs(out, 'users'), routes = objs(out, 'routes'), photos = objs(out, 'photos');
  const ratings = objs(out, 'ratings'), reviews = objs(out, 'reviews'), rides = objs(out, 'route_rides'), rbs = objs(out, 'roadbooks');
  const uName = new Map(users.map(u => [u.id, u.display_name || u.username]));
  const rName = new Map(routes.map(r => [r.id, r.name]));
  const files = [];
  const folder = r => String(r.id).padStart(3, '0') + ' ' + safeName(r.name);
  // GPX a fotky
  const gpxName = new Map();
  routes.forEach(r => { const n = 'gpx/' + folder(r) + '.gpx'; gpxName.set(r.id, n); files.push({ name: n, data: gpxOf(r.name, r.points) }); });
  const photoCount = new Map();
  photos.slice().sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || a.id - b.id).forEach(p => {
    const r = routes.find(x => x.id === p.route_id); if(!r) return;
    const m = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(p.data_url || ''); if(!m) return;
    const k = (photoCount.get(r.id) || 0) + 1; photoCount.set(r.id, k);
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    files.push({ name: 'fotky/' + folder(r) + '/' + k + (p.is_main ? ' hlavni' : '') + '.' + ext, data: Buffer.from(m[2], 'base64') });
  });
  // souhrny pro tabulku tras
  const ridesBy = new Map(), ridersBy = new Map();
  rides.forEach(x => { ridesBy.set(x.route_id, (ridesBy.get(x.route_id) || 0) + 1); if(!ridersBy.has(x.route_id)) ridersBy.set(x.route_id, new Set()); ridersBy.get(x.route_id).add(x.user_id); });
  const rateBy = new Map(); ratings.forEach(x => { const a = rateBy.get(x.route_id) || []; a.push(+x.stars); rateBy.set(x.route_id, a); });
  const revBy = new Map(); reviews.forEach(x => revBy.set(x.route_id, (revBy.get(x.route_id) || 0) + 1));
  const rbBy = new Map(rbs.map(x => [x.route_id, x]));
  const rbLabel = x => !x ? '' : (x.status === 'ready' ? 'Ready' : 'Rozpracovaný');
  const rbItems = x => x && x.data && Array.isArray(x.data.items) ? x.data.items.length : null;
  const sheetRoutes = {
    name: 'Trasy',
    columns: [{ title: 'ID', width: 6 }, { title: 'Název', width: 34 }, { title: 'Autor', width: 16 }, { title: 'Typ', width: 10 }, { title: 'Km', width: 8 },
      { title: 'Převýšení (m)', width: 12 }, { title: 'Vytvořeno', width: 16 }, { title: 'Zdroj', width: 13 }, { title: 'Roadbook', width: 13 }, { title: 'Instrukcí', width: 9 },
      { title: 'Projetí', width: 8 }, { title: 'Jezdců', width: 8 }, { title: 'Hodnocení Ø', width: 11 }, { title: 'Hodnocení (počet)', width: 11 }, { title: 'Recenzí', width: 8 },
      { title: 'Fotek', width: 7 }, { title: 'V archivu (smazaná)', width: 12 }, { title: 'Popis', width: 50 }, { title: 'Soubor GPX', width: 40 }],
    rows: routes.slice().sort((a, b) => a.id - b.id).map(r => {
      const st = rateBy.get(r.id) || [];
      return [r.id, r.name, uName.get(r.owner_id) || '', TYPES[r.route_type] || r.route_type || '', num(r.distance_km, 1), num(r.elev_gain_m, 0), dt(r.created_at),
        r.source === 'record' ? 'záznam jízdy' : 'nahraný GPX', rbLabel(rbBy.get(r.id)), rbItems(rbBy.get(r.id)),
        ridesBy.get(r.id) || 0, ridersBy.has(r.id) ? ridersBy.get(r.id).size : 0, st.length ? num(st.reduce((a, b) => a + b, 0) / st.length, 1) : null, st.length,
        revBy.get(r.id) || 0, photoCount.get(r.id) || 0, r.deleted_at ? true : false, r.description || '', gpxName.get(r.id)];
    })
  };
  const ownBy = new Map(); routes.filter(r => !r.deleted_at).forEach(r => ownBy.set(r.owner_id, (ownBy.get(r.owner_id) || 0) + 1));
  const userRides = new Map(); rides.forEach(x => userRides.set(x.user_id, (userRides.get(x.user_id) || 0) + 1));
  const sheetUsers = {
    name: 'Uživatelé',
    columns: [{ title: 'ID', width: 6 }, { title: 'Přezdívka', width: 18 }, { title: 'E-mail / login', width: 28 }, { title: 'Role', width: 8 }, { title: 'Schválen', width: 9 },
      { title: 'Najeto km', width: 10 }, { title: 'Tras', width: 6 }, { title: 'Projetí', width: 8 }, { title: 'Odznaky', width: 9 }, { title: 'Motorka', width: 18 },
      { title: 'Registrace', width: 16 }, { title: 'Naposledy přihlášen', width: 16 }, { title: 'Naposledy aktivní', width: 16 }, { title: 'Získané odznaky', width: 40 }],
    rows: users.slice().sort((a, b) => a.id - b.id).map(u => {
      const be = u.badges_earned && typeof u.badges_earned === 'object' ? Object.keys(u.badges_earned) : [];
      return [u.id, u.display_name, u.username, u.role, !!u.is_approved, num((+u.ride_m || 0) / 1000, 1), ownBy.get(u.id) || 0, userRides.get(u.id) || 0, be.length, u.bike || '',
        dt(u.created_at), dt(u.last_login_at), dt(u.last_seen_at), be.join(', ')];
    })
  };
  const sheetRides = {
    name: 'Projetí',
    columns: [{ title: 'Datum', width: 16 }, { title: 'Trasa', width: 34 }, { title: 'Jezdec', width: 18 }, { title: 'Projeto %', width: 10 }, { title: 'Jak', width: 14 }],
    rows: rides.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(x => [dt(x.created_at), rName.get(x.route_id) || ('#' + x.route_id), uName.get(x.user_id) || ('#' + x.user_id),
      x.coverage == null ? null : Math.round(+x.coverage * 100), SRC[x.source] || x.source || ''])
  };
  // hodnocení a recenze dohromady: jeden řádek na trasu + jezdce
  const rv = new Map();
  ratings.forEach(x => rv.set(x.route_id + ':' + x.user_id, { route_id: x.route_id, user_id: x.user_id, stars: +x.stars, at: x.updated_at }));
  reviews.forEach(x => { const k = x.route_id + ':' + x.user_id, o = rv.get(k) || { route_id: x.route_id, user_id: x.user_id }; o.text = x.text; o.at = x.updated_at || x.created_at || o.at; rv.set(k, o); });
  const sheetReviews = {
    name: 'Hodnocení a recenze',
    columns: [{ title: 'Datum', width: 16 }, { title: 'Trasa', width: 34 }, { title: 'Jezdec', width: 18 }, { title: 'Hvězdy', width: 8 }, { title: 'Recenze', width: 70 }],
    rows: [...rv.values()].sort((a, b) => new Date(b.at) - new Date(a.at)).map(o => [dt(o.at), rName.get(o.route_id) || ('#' + o.route_id), uName.get(o.user_id) || ('#' + o.user_id), o.stars || null, o.text || ''])
  };
  const sheetRb = {
    name: 'Roadbooky',
    columns: [{ title: 'Trasa', width: 34 }, { title: 'Stav', width: 13 }, { title: 'Instrukcí', width: 9 }, { title: 'Upravil', width: 18 }, { title: 'Upraveno', width: 16 }, { title: 'Vytvořeno', width: 16 }],
    rows: rbs.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).map(x => [rName.get(x.route_id) || ('#' + x.route_id), rbLabel(x), rbItems(x), uName.get(x.updated_by) || '', dt(x.updated_at), dt(x.created_at)])
  };
  const readme = 'CendurOFF – záloha ' + new Date(created).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }) + '\r\n\r\n' +
    'prehled.xlsx              přehled v Excelu: trasy, uživatelé, projetí, hodnocení a recenze, roadbooky\r\n' +
    'gpx\\                      každá trasa jako GPX (Mapy.com, Locus, Garmin…)\r\n' +
    'fotky\\                    fotky tras, složka pro každou trasu\r\n' +
    'zaloha-databaze.json.gz   celá databáze – pro obnovu: Admin → Obnovit ze zálohy (vyber celý tento ZIP)\r\n\r\n' +
    'Trasy: ' + routes.length + ' · uživatelé: ' + users.length + ' · fotky: ' + photos.length + ' · roadbooky: ' + rbs.length + '\r\n';
  return zipBuild([
    { name: 'PRECTI-ME.txt', data: readme },
    { name: 'prehled.xlsx', data: xlsxBuild([sheetRoutes, sheetUsers, sheetRides, sheetReviews, sheetRb]) },
    { name: 'zaloha-databaze.json.gz', data: dbGz }
  ].concat(files));
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
      const now = new Date(), loc = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
      const p2 = n => String(n).padStart(2, '0');
      const stamp = loc.getFullYear() + '-' + p2(loc.getMonth() + 1) + '-' + p2(loc.getDate()) + '-' + p2(loc.getHours()) + p2(loc.getMinutes());
      const zip = buildExport(out, now.toISOString(), gz);
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename="cenduroff-zaloha-' + stamp + '.zip"');
      res.set('X-Backup-Counts', encodeURIComponent(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.rows.length])))));
      res.set('Access-Control-Expose-Headers', 'X-Backup-Counts, Content-Disposition');
      res.send(zip);
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
        let gzb = buf;
        // celý ZIP ze zálohy → vezmi z něj zaloha-databaze.json.gz
        if(buf[0] === 0x50 && buf[1] === 0x4b){
          const e = zipRead(buf).find(f => /(^|\/)zaloha-databaze\.json(\.gz)?$/i.test(f.name));
          if(!e) throw new Error('v ZIPu chybí záloha databáze');
          gzb = e.data;
        }
        const txt = (gzb[0] === 0x1f && gzb[1] === 0x8b) ? zlib.gunzipSync(gzb).toString('utf8') : gzb.toString('utf8');
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
