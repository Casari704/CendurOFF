// CendurOFF – data z OpenStreetMap k trasám a do mapy (v4.35)
//   GET /api/routes/:id/terrain → povrch trasy (asfalt / šotolina / hlína a ostatní / nezmapováno),
//                                 brody a závory na trase. Spočítá se jednou pro každou podobu trasy
//                                 a uloží (route_terrain); když trasu někdo upraví, spočítá se znovu.
//                                 Když výpočet ještě běží, vrací 202 { status:'pending' } – klient zkusí znovu.
//   GET /api/osm/points?cells=x_y,x_y… → brody a závory v mřížce 0,1° (vrstvy v mapě).
//                                 Server si celou oblast ČR + 100 km stáhne předem sám (po blocích, jednou
//                                 za 30 dní) a drží ji v databázi (osm_cell) – klient dostane data hned.
//                                 Chybějící buňku (mimo oblast) stáhne na požádání.
const crypto = require('crypto');
const { overpass: overpassRaw, REGION } = require('./region-api');

// v4.37: všechny dotazy na Overpass po jednom ve frontě (veřejný server souběžné dotazy odmítá a zdržuje);
// co si vyžádal uživatel (otevřel detail, posunul mapu), jde na řadu před přípravou na pozadí
const queue = [];
let busy = false, busySince = 0, busyWhat = '';
const stat = { ok: 0, failed: 0, lastError: '', lastErrorAt: 0, lastOkMs: 0 };
function overpass(query, ctx){
  return new Promise((res, rej) => { queue.push({ query, ctx: ctx || { prio: 0 }, res, rej, t: Date.now() }); pump(); });
}
async function pump(){
  if(busy || !queue.length) return;
  queue.sort((a, b) => (b.ctx.prio - a.ctx.prio) || (a.t - b.t));
  const job = queue.shift();
  busy = true; busySince = Date.now(); busyWhat = job.ctx.what || '';
  try{ const r = await overpassRaw(job.query); stat.ok++; stat.lastOkMs = Date.now() - busySince; job.res(r); }
  catch(e){ stat.failed++; stat.lastError = e.message; stat.lastErrorAt = Date.now(); job.rej(e); }
  finally{ busy = false; busyWhat = ''; setTimeout(pump, 1500); }
}
const HIGH = 10;     // vyžádal uživatel (kousek mapy s brody a závorami)
const TOP = 20;      // povrch trasy, kterou má uživatel otevřenou – před vším ostatním

const SCHEMA = `
CREATE TABLE IF NOT EXISTS route_terrain (route_id INTEGER PRIMARY KEY, hash TEXT NOT NULL, data TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS osm_cell (cell TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`;
const TERRAIN_MAX_AGE_MS = 60 * 86400000;   // OSM se mění – jednou za 2 měsíce přepočítat na pozadí
const CELL_MAX_AGE_MS = 30 * 86400000;
const CELL = 0.1;
const MATCH_M = 20;          // bod trasy patří k cestě do 20 m (nepřesnost GPS a mapy)
const STEP_M = 20;           // trasa se pro výpočet podílů projde po 20 m

// závory a zábrany, které na cestě zastaví motorku (sloupky ne – motorka jimi většinou projede)
const BARRIER_RE = '^(gate|lift_gate|swing_gate|chain|bar|log|jersey_barrier|block|full-height_turnstile|kissing_gate|stile)$';

// ---------- geometrie (místní rovinná projekce v metrech) ----------
function projector(lat0){
  const ky = 111320, kx = 111320 * Math.cos(lat0 * Math.PI / 180);
  return (lat, lon) => [lon * kx, lat * ky];
}
function hav(a, b){
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function segDist2(px, py, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  const ex = ax + t * dx - px, ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}
// Douglas–Peucker nad body [lat, lon] (tol v metrech) – pro dotaz na Overpass stačí tvar trasy
function simplify(pts, tol){
  if(pts.length < 3) return pts;
  const P = projector(pts[0][0]), xy = pts.map(p => P(p[0], p[1]));
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while(stack.length){
    const [a, b] = stack.pop();
    let md = tol * tol, mi = -1;
    for(let i = a + 1; i < b; i++){
      const d = segDist2(xy[i][0], xy[i][1], xy[a][0], xy[a][1], xy[b][0], xy[b][1]);
      if(d > md){ md = d; mi = i; }
    }
    if(mi > 0){ keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((p, i) => keep[i]);
}
// body trasy po STEP_M metrech
function resample(pts, step){
  const out = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for(let i = 1; i < pts.length; i++){
    const a = pts[i - 1], b = pts[i], d = hav(a, b);
    if(!d) continue;
    let s = step - carry;
    while(s <= d){
      const t = s / d;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      s += step;
    }
    carry = d - (s - step);
  }
  return out;
}

// ---------- povrch cesty ze značek OSM ----------
const PAVED_SURF = /^(asphalt|paved|concrete|concrete:plates|concrete:lanes|paving_stones|sett|cobblestone|unhewn_cobblestone|chipseal|metal|bricks)$/;
const GRAVEL_SURF = /^(gravel|fine_gravel|compacted|pebblestone|shells)$/;
const ROADS = /^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road)$/;
// 'asfalt' | 'sotolina' | 'hlina'
function surfaceClass(t){
  const sf = (t.surface || '').split(';')[0].trim();
  if(sf){
    if(PAVED_SURF.test(sf)) return 'asfalt';
    if(GRAVEL_SURF.test(sf)) return 'sotolina';
    return 'hlina';   // dirt, ground, earth, grass, mud, sand, rock, unpaved, …
  }
  const h = t.highway;
  if(ROADS.test(h)) return 'asfalt';
  if(h === 'cycleway') return 'asfalt';
  if(h === 'track'){
    if(t.tracktype === 'grade1' || t.tracktype === 'grade2') return 'sotolina';
    return 'hlina';
  }
  return 'hlina';   // path, bridleway, footway, …
}

// shluky bodů blíž než minM sloučí do jednoho (brod zakreslený bodem i čarou apod.)
function cluster(items, minM){
  const out = [];
  items.forEach(it => { if(!out.some(o => o[2] === it[2] && hav(o, it) < minM)) out.push(it); });
  return out;
}

// ---------- výpočet terénu trasy ----------
async function buildTerrain(points, ctx){
  const pts = points.filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).map(p => [+p[0], +p[1]]);
  if(pts.length < 2) return { surface:{ asfalt:0, sotolina:0, hlina:0, nezname:1 }, items:[], fords:0, barriers:0 };
  const simple = simplify(pts, 8).map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5));
  const CH = 300, chunks = [];
  for(let i = 0; i < simple.length - 1; i += CH) chunks.push(simple.slice(i, Math.min(simple.length, i + CH + 1)).join(','));
  if(!chunks.length) chunks.push(simple.join(','));

  const ways = new Map(), items = [];
  for(const C of chunks){
    const q = `[out:json][timeout:120];
way["highway"](around:${MATCH_M},${C});
out tags geom qt;
(node["ford"]["ford"!="no"](around:25,${C});
 way["ford"]["ford"!="no"](around:25,${C});
 node["barrier"~"${BARRIER_RE}"](around:15,${C}););
out center tags qt;`;
    const d = await overpass(q, ctx);
    (d.elements || []).forEach(el => {
      const t = el.tags || {};
      if(el.type === 'way' && t.highway && el.geometry && !ways.has(el.id)) ways.set(el.id, { t, g: el.geometry.map(g => [g.lat, g.lon]) });
      const lat = el.lat != null ? el.lat : el.center && el.center.lat, lon = el.lon != null ? el.lon : el.center && el.center.lon;
      if(lat == null) return;
      if(t.ford && t.ford !== 'no') items.push([+lat.toFixed(6), +lon.toFixed(6), 'f']);
      else if(t.barrier) items.push([+lat.toFixed(6), +lon.toFixed(6), 'b', t.barrier]);
    });
  }

  // rychlé hledání nejbližší cesty: mřížka 50 m s úsečkami cest
  const P = projector(pts[0][0]), G = 50, grid = new Map();
  const segs = [];
  ways.forEach(w => {
    const cls = surfaceClass(w.t), xy = w.g.map(g => P(g[0], g[1]));
    for(let i = 1; i < xy.length; i++){
      const s = { ax: xy[i - 1][0], ay: xy[i - 1][1], bx: xy[i][0], by: xy[i][1], cls };
      segs.push(s);
      const x0 = Math.floor((Math.min(s.ax, s.bx) - MATCH_M) / G), x1 = Math.floor((Math.max(s.ax, s.bx) + MATCH_M) / G);
      const y0 = Math.floor((Math.min(s.ay, s.by) - MATCH_M) / G), y1 = Math.floor((Math.max(s.ay, s.by) + MATCH_M) / G);
      for(let x = x0; x <= x1; x++) for(let y = y0; y <= y1; y++){
        const k = x + '_' + y; let a = grid.get(k); if(!a){ a = []; grid.set(k, a); } a.push(s);
      }
    }
  });
  const cnt = { asfalt:0, sotolina:0, hlina:0, nezname:0 };
  const samples = resample(pts, STEP_M);
  samples.forEach(p => {
    const [px, py] = P(p[0], p[1]);
    const cand = grid.get(Math.floor(px / G) + '_' + Math.floor(py / G)) || [];
    let best = MATCH_M * MATCH_M, cls = 'nezname';
    for(const s of cand){ const d = segDist2(px, py, s.ax, s.ay, s.bx, s.by); if(d <= best){ best = d; cls = s.cls; } }
    cnt[cls]++;
  });
  const n = samples.length || 1;
  const surface = {}; Object.keys(cnt).forEach(k => surface[k] = +(cnt[k] / n).toFixed(4));
  const its = cluster(items.filter(i => i[2] === 'f'), 40).concat(cluster(items.filter(i => i[2] === 'b'), 15));
  return { v: 1, surface, items: its, fords: its.filter(i => i[2] === 'f').length, barriers: its.filter(i => i[2] === 'b').length };
}

// ---------- brody a závory v buňce mřížky (vrstvy v mapě) ----------
function cellBox(cell){
  const [x, y] = cell.split('_').map(Number);
  return { s: y * CELL, w: x * CELL, n: (y + 1) * CELL, e: (x + 1) * CELL };
}
// brody a závory v obdélníku → seznam [id, lat, lon, 'f'|'b', a, b]
async function buildBox(b, ctx){
  const bb = `${b.s.toFixed(3)},${b.w.toFixed(3)},${b.n.toFixed(3)},${b.e.toFixed(3)}`;
  // závory jen na cestách, kudy se dá jet (ne u vjezdů k domům a na parkovištích)
  // v4.38: nejdřív jen závory (málo bodů), pak cesty, na kterých leží, a z nich jen ty závory –
  // o řád rychlejší než procházet všechny body všech cest v oblasti
  const q = `[out:json][timeout:120];
node["barrier"~"${BARRIER_RE}"](${bb})->.b;
way(bn.b)["highway"~"^(track|path|bridleway|unclassified|service|tertiary|byway|cycleway)$"]["service"!~"driveway|parking_aisle|drive-through"]->.w;
node.b(w.w)->.ok;
(node["ford"]["ford"!="no"](${bb});
 way["ford"]["ford"!="no"](${bb});
 node.ok;);
out center tags qt;`;
  const d = await overpass(q, ctx);
  const out = [];
  (d.elements || []).forEach(el => {
    const t = el.tags || {};
    const lat = el.lat != null ? el.lat : el.center && el.center.lat, lon = el.lon != null ? el.lon : el.center && el.center.lon;
    if(lat == null) return;
    if(t.ford && t.ford !== 'no') out.push([el.type[0] + el.id, +lat.toFixed(6), +lon.toFixed(6), 'f', t.name || '', '']);
    else if(t.barrier) out.push([el.type[0] + el.id, +lat.toFixed(6), +lon.toFixed(6), 'b', t.barrier, t.access || t.motor_vehicle || '']);
  });
  return out;
}
const cellOf = (lat, lon) => Math.floor(lon * 10 + 1e-9) + '_' + Math.floor(lat * 10 + 1e-9);   // CELL = 0,1°
async function buildCell(cell, ctx){ return buildBox(cellBox(cell), ctx); }
// celá oblast ČR + 100 km po blocích 1° × 0,5° (každý blok = jeden dotaz) → rozdělit do buněk 0,1°
// blok 1° × 0,5°: id „x_y“ = floor(lon) _ floor(lat*2)
const blockOf = (lat, lon) => Math.floor(lon) + '_' + Math.floor(lat * 2);
function blockBox(id){ const [x, y] = id.split('_').map(Number); return { s: y / 2, w: x, n: y / 2 + 0.5, e: x + 1 }; }
function blockCells(b){
  const out = [];
  for(let y = Math.round(b.s / CELL); y < Math.round(b.n / CELL); y++)
    for(let x = Math.round(b.w / CELL); x < Math.round(b.e / CELL); x++) out.push(x + '_' + y);
  return out;
}
function regionBlocks(){
  const out = [];
  for(let s = Math.floor(REGION.s * 2) / 2; s < REGION.n; s += 0.5)
    for(let w = Math.floor(REGION.w); w < REGION.e; w += 1) out.push({ s, w, n: s + 0.5, e: w + 1 });
  return out;
}

function mount(app, { pool }){
  let ready = null;
  const ensure = () => ready || (ready = pool.query(SCHEMA).catch(e => { ready = null; throw e; }));
  (app.locals.cendurSchemas = app.locals.cendurSchemas || []).push(() => pool.query(SCHEMA));

  // ---- terén trasy ----
  const building = new Map();   // route_id:hash -> Promise
  function computeTerrain(id, hash, points, prio){
    const key = id + ':' + hash;
    const had = building.get(key);
    if(had){ if(prio) had.ctx.prio = Math.max(had.ctx.prio, prio); return had.p; }   // už se počítá – jen zvýšit přednost
    const ctx = { prio: prio || 0, what: 'povrch trasy ' + id };
    const p = (async () => {
      const data = await buildTerrain(points, ctx);
      const text = JSON.stringify(data);
      await pool.query(`INSERT INTO route_terrain (route_id, hash, data, updated_at) VALUES ($1, $2, $3, now())
                        ON CONFLICT (route_id) DO UPDATE SET hash = EXCLUDED.hash, data = EXCLUDED.data, updated_at = now()`, [id, hash, text]);
      return text;
    })().finally(() => building.delete(key));
    building.set(key, { p, ctx });
    return p;
  }
  // v4.39: brody a závory po blocích 1° × 0,5° (mapa je ukazuje už od přiblížení 10 jako benzínky)
  app.get('/api/osm/blocks', async (req, res) => {
    const ids = String(req.query.ids || '').split(',').filter(c => /^-?\d{1,3}_-?\d{1,3}$/.test(c)).slice(0, 16);
    if(!ids.length) return res.status(400).json({ error: 'Chybí bloky.' });
    try{
      await ensure();
      const out = [], pending = [], t0 = Date.now();
      for(const id of ids){
        const cells = blockCells(blockBox(id));
        const r = await pool.query('SELECT data FROM osm_cell WHERE cell = ANY($1)', [cells]);
        if(r.rows.length >= cells.length){ out.push('"' + id + '":[' + r.rows.map(x => x.data.slice(1, -1)).filter(Boolean).join(',') + ']'); continue; }
        // blok ještě není stažený – stáhnout přednostně; na dlouhé čekání se klient zeptá znovu
        const job = storeBlock(id, { prio: HIGH, what: 'brody a závory – blok ' + id });
        job.catch(e => console.error('osm blok', id, e.message));
        const left = Math.max(0, 20000 - (Date.now() - t0));
        const items = left ? await Promise.race([job.catch(() => null), new Promise(r2 => setTimeout(() => r2(null), left))]) : null;
        if(items) out.push('"' + id + '":' + JSON.stringify(items)); else pending.push(id);
      }
      res.set('Cache-Control', 'public, max-age=600');
      res.type('application/json').send('{"blocks":{' + out.join(',') + '},"pending":' + JSON.stringify(pending) + '}');
    }catch(e){
      console.error('osm blocks', e.message);
      res.status(503).json({ error: 'Data teď nejdou připravit (' + e.message + ').' });
    }
  });

  // stav fronty – pro kontrolu, co server zrovna dělá
  app.get('/api/osm/status', async (req, res) => {
    let routes = null, ready = null, cells = null;
    try{
      await ensure();
      routes = (await pool.query('SELECT count(*)::int n FROM routes WHERE deleted_at IS NULL')).rows[0].n;
      ready = (await pool.query('SELECT count(*)::int n FROM route_terrain')).rows[0].n;
      cells = (await pool.query("SELECT count(*)::int n FROM osm_cell WHERE cell <> 'osm-points-region'")).rows[0].n;
    }catch(e){}
    res.json({
      prave_bezi: busy ? busyWhat + ' (' + Math.round((Date.now() - busySince) / 1000) + ' s)' : 'nic',
      ve_fronte: queue.slice().sort((a, b) => (b.ctx.prio - a.ctx.prio) || (a.t - b.t)).map(j => (j.ctx.prio >= TOP ? '★★ ' : j.ctx.prio ? '★ ' : '') + (j.ctx.what || '?')),
      povrch_tras: ready + ' z ' + routes,
      bunky_brody_zavory: cells,
      dotazu_ok: stat.ok, dotazu_chyba: stat.failed,
      posledni_chyba: stat.lastError ? stat.lastError + ' (před ' + Math.round((Date.now() - stat.lastErrorAt) / 60000) + ' min)' : '',
      posledni_dotaz_trval_s: Math.round(stat.lastOkMs / 1000)
    });
  });
  app.get('/api/routes/:id/terrain', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if(!id) return res.status(400).json({ error: 'Neplatná trasa.' });
    try{
      await ensure();
      const r = await pool.query('SELECT points FROM routes WHERE id = $1 AND deleted_at IS NULL', [id]);
      if(!r.rows[0]) return res.status(404).json({ error: 'Trasa nenalezena.' });
      const points = r.rows[0].points;
      const hash = crypto.createHash('md5').update(JSON.stringify(points)).digest('hex');
      const c = await pool.query('SELECT hash, data, updated_at FROM route_terrain WHERE route_id = $1', [id]);
      const row = c.rows[0];
      if(row && row.hash === hash){
        if(Date.now() - new Date(row.updated_at).getTime() > TERRAIN_MAX_AGE_MS) computeTerrain(id, hash, points).catch(e => console.error('terrain refresh', id, e.message));
        res.set('Cache-Control', 'public, max-age=600');
        return res.type('application/json').send('{"status":"ok","data":' + row.data + '}');
      }
      // první výpočet (nebo po úpravě trasy) – chvíli počkáme, jinak ať se klient zeptá znovu
      const job = computeTerrain(id, hash, points, TOP);
      job.catch(e => console.error('terrain', id, e.message));
      const text = await Promise.race([job, new Promise(r2 => setTimeout(() => r2(null), 20000))]);
      if(text) return res.type('application/json').send('{"status":"ok","data":' + text + '}');
      return res.status(202).json({ status: 'pending' });
    }catch(e){
      console.error('terrain', id, e.message);
      res.status(503).json({ error: 'Povrch trasy teď nejde zjistit (' + e.message + ').' });
    }
  });

  // ---- brody a závory po buňkách ----
  const cellJobs = new Map();
  function fetchCell(cell){
    if(cellJobs.has(cell)) return cellJobs.get(cell);
    const p = (async () => {
      const data = await buildCell(cell, { prio: HIGH, what: 'brody a závory ' + cell });
      const text = JSON.stringify(data);
      await pool.query(`INSERT INTO osm_cell (cell, data, updated_at) VALUES ($1, $2, now())
                        ON CONFLICT (cell) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [cell, text]);
      return text;
    })().finally(() => cellJobs.delete(cell));
    cellJobs.set(cell, p);
    return p;
  }
  app.get('/api/osm/points', async (req, res) => {
    const cells = String(req.query.cells || '').split(',').filter(c => /^-?\d{1,4}_-?\d{1,4}$/.test(c)).slice(0, 12);
    if(!cells.length) return res.status(400).json({ error: 'Chybí buňky.' });
    try{
      await ensure();
      const r = await pool.query('SELECT cell, data, updated_at FROM osm_cell WHERE cell = ANY($1)', [cells]);
      const have = new Map(r.rows.map(x => [x.cell, x]));
      const parts = [], pending = [];
      for(const cell of cells){
        const row = have.get(cell);
        if(row){
          if(Date.now() - new Date(row.updated_at).getTime() > CELL_MAX_AGE_MS) fetchCell(cell).catch(e => console.error('osm cell', cell, e.message));
          parts.push('"' + cell + '":' + row.data);
        } else pending.push(cell);
      }
      // chybějící buňky stahujeme po jedné (Overpass nemá rád souběžné dotazy); co nestihneme, klient dožádá
      const t0 = Date.now();
      const later = [];
      for(const cell of pending){
        if(Date.now() - t0 > 20000){ later.push(cell); fetchCell(cell).catch(() => {}); continue; }
        try{ parts.push('"' + cell + '":' + await fetchCell(cell)); }
        catch(e){ console.error('osm cell', cell, e.message); later.push(cell); }
      }
      res.type('application/json').send('{"cells":{' + parts.join(',') + '},"pending":' + JSON.stringify(later) + '}');
    }catch(e){
      console.error('osm points', e.message);
      res.status(503).json({ error: 'Data teď nejdou připravit (' + e.message + ').' });
    }
  });

  // ---- předem připravit vše na serveru (jako benzínky a CHKO) ----
  // 1) brody a závory pro celou oblast: blok po bloku, s pauzou, obnova jednou za 30 dní
  const REGION_KEY = 'osm-points-region';
  // jeden blok 1° × 0,5° jedním dotazem → rozdělit do buněk 0,1° (i prázdné, ať se na ně nikdo zbytečně neptá)
  const blockJobs = new Map();
  function storeBlock(id, ctx){
    const had = blockJobs.get(id);
    if(had){ if(ctx.prio) had.ctx.prio = Math.max(had.ctx.prio, ctx.prio); return had.p; }
    const p = (async () => {
      const b = blockBox(id);
      const items = await buildBox(b, ctx);
      const byCell = new Map(blockCells(b).map(c => [c, []]));
      items.forEach(it => { const c = cellOf(it[1], it[2]); if(byCell.has(c)) byCell.get(c).push(it); });
      for(const [cell, list] of byCell)
        await pool.query(`INSERT INTO osm_cell (cell, data, updated_at) VALUES ($1, $2, now())
                          ON CONFLICT (cell) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [cell, JSON.stringify(list)]);
      return items;
    })().finally(() => blockJobs.delete(id));
    blockJobs.set(id, { p, ctx });
    return p;
  }
  async function blockFresh(id){
    const cells = blockCells(blockBox(id));
    const r = await pool.query(`SELECT count(*)::int n FROM osm_cell WHERE cell = ANY($1) AND updated_at > now() - interval '30 days'`, [cells]);
    return r.rows[0].n >= cells.length;
  }
  async function prebuildRegion(){
    const blocks = regionBlocks();
    let done = 0, skipped = 0;
    for(const b of blocks){
      const id = blockOf(b.s + 0.01, b.w + 0.01);
      try{
        if(await blockFresh(id)){ skipped++; continue; }   // po restartu pokračuje, kde přestal
        await storeBlock(id, { prio: 0, what: 'brody a závory – oblast ' + (done + skipped + 1) + '/' + blocks.length });
        done++;
      }catch(e){ console.error('osm prebuild blok', id, e.message); }
    }
    console.log('OSM brody/závory: staženo', done, 'bloků, aktuálních', skipped, 'z', blocks.length);
  }
  // 2) povrch všech tras, které ho ještě nemají (nebo se od výpočtu změnily)
  async function prebuildTerrain(){
    let n = 0;
    const r = await pool.query(`SELECT r.id, r.points, t.hash FROM routes r LEFT JOIN route_terrain t ON t.route_id = r.id WHERE r.deleted_at IS NULL`);
    for(const row of r.rows){
      const hash = crypto.createHash('md5').update(JSON.stringify(row.points)).digest('hex');
      if(row.hash === hash) continue;
      try{ await computeTerrain(row.id, hash, row.points); n++; }catch(e){ console.error('terrain prebuild', row.id, e.message); }
    }
  }
  setTimeout(async () => {
    try{ await ensure(); await prebuildTerrain(); console.log('OSM povrch tras: hotovo'); await prebuildRegion(); }
    catch(e){ console.error('osm init', e.message); }
  }, 20000);
  // jednou denně zkontrolovat, jestli není co obnovit (nové trasy, data starší než 30 dní)
  setInterval(() => { prebuildTerrain().then(prebuildRegion).catch(e => console.error('osm denní', e.message)); }, 86400000);
}
module.exports = { mount, _test: { buildTerrain, surfaceClass, resample, simplify, buildCell, regionBlocks, blockOf, blockBox, blockCells } };
