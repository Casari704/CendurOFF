// CendurOFF – sdílená data oblasti „ČR + 100 km“ (CHKO, benzínky) na serveru (v4.12)
// Server je jednou za týden stáhne z OpenStreetMap (Overpass), zpracuje stejně jako web
// (public/chko.js, public/fuel.js) a uloží do databáze. Telefony a prohlížeče si je pak berou odtud –
// rychle a spolehlivě, i když jsou veřejné servery Overpass přetížené.
//   GET /api/region/:kind   (kind = chko | fuel) → { t, data }
const REGION = { s:47.65, w:10.70, n:51.96, e:20.26 };
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const MAX_AGE_MS = 7 * 86400000;
const SCHEMA = `CREATE TABLE IF NOT EXISTS region_cache (kind TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`;

function bboxStr(b){ return `${b.s.toFixed(3)},${b.w.toFixed(3)},${b.n.toFixed(3)},${b.e.toFixed(3)}`; }
function stripes(n){
  const out = [], step = (REGION.e - REGION.w) / n;
  for(let i=0;i<n;i++) out.push({ s:REGION.s, n:REGION.n, w:REGION.w + i*step, e:REGION.w + (i+1)*step });
  return out;
}
async function overpass(query){
  let lastErr = null;
  for(let round = 0; round < 2; round++){
    for(const url of OVERPASS_URLS){
      const ctl = new AbortController(); const timer = setTimeout(()=>ctl.abort(), 200000);
      try{
        const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'User-Agent':'CendurOFF/1.0 (cenduroff-web)' }, body:'data=' + encodeURIComponent(query), signal: ctl.signal });
        if(!res.ok) throw new Error('server ' + res.status);
        const json = await res.json();
        if(json.remark && /runtime error|timed out|out of memory/i.test(json.remark) && !(json.elements||[]).length) throw new Error('server přetížený');
        return json;
      }catch(err){ lastErr = err && err.name === 'AbortError' ? new Error('vypršel čas') : err; }
      finally{ clearTimeout(timer); }
    }
    await new Promise(r => setTimeout(r, 20000));   // druhé kolo po pauze
  }
  throw lastErr || new Error('Overpass nedostupný');
}

// ---- CHKO: stejné zpracování jako public/chko.js ----
  function samePt(a, b){ return a && b && Math.abs(a[0]-b[0]) < 1e-7 && Math.abs(a[1]-b[1]) < 1e-7; }
function joinRings(ways){
  const rest = ways.filter(w=>w.length >= 2).map(w=>w.slice());
  const rings = [];
  while(rest.length){
    let ring = rest.shift();
    let grew = true;
    while(!samePt(ring[0], ring[ring.length-1]) && grew){
      grew = false;
      for(let i=0;i<rest.length;i++){
        const w = rest[i], end = ring[ring.length-1], start = ring[0];
        if(samePt(end, w[0])){ ring = ring.concat(w.slice(1)); }
        else if(samePt(end, w[w.length-1])){ ring = ring.concat(w.slice(0, -1).reverse()); }
        else if(samePt(start, w[w.length-1])){ ring = w.slice(0, -1).concat(ring); }
        else if(samePt(start, w[0])){ ring = w.slice(1).reverse().concat(ring); }
        else continue;
        rest.splice(i, 1); grew = true; break;
      }
    }
    if(ring.length >= 4) rings.push(ring);
  }
  return rings;
}
// Douglas-Peucker - zjednodušení čáry (tol ve stupních, 0.0001 ≈ 10 m)
function simplify(pts, tol){
  if(pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1;
  const stack = [[0, pts.length-1]];
  const kx = Math.cos(pts[0][0] * Math.PI/180);
  while(stack.length){
    const [i0, i1] = stack.pop();
    const ax = pts[i0][1]*kx, ay = pts[i0][0], bx = pts[i1][1]*kx, by = pts[i1][0];
    const dx = bx-ax, dy = by-ay, len2 = dx*dx + dy*dy;
    let best = -1, bestD = tol*tol;
    for(let i=i0+1;i<i1;i++){
      const px = pts[i][1]*kx, py = pts[i][0];
      let t = len2 ? ((px-ax)*dx + (py-ay)*dy) / len2 : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t*dx - px, ey = ay + t*dy - py, d = ex*ex + ey*ey;
      if(d > bestD){ bestD = d; best = i; }
    }
    if(best > 0){ keep[best] = 1; stack.push([i0, best], [best, i1]); }
  }
  return pts.filter((p, i)=>keep[i]);
}
function parseElements(elements){
  const out = [];
  (elements || []).forEach(el=>{
    const t = el.tags || {};
    let outer = [], inner = [];
    if(el.type === 'relation'){
      (el.members || []).forEach(m=>{
        if(m.type !== 'way' || !m.geometry) return;
        const pts = m.geometry.map(g=>[+g.lat.toFixed(5), +g.lon.toFixed(5)]);
        (m.role === 'inner' ? inner : outer).push(pts);
      });
    } else if(el.type === 'way' && el.geometry){
      outer.push(el.geometry.map(g=>[+g.lat.toFixed(5), +g.lon.toFixed(5)]));
    }
    const rings = joinRings(outer).concat(joinRings(inner)).map(r=>simplify(r, 0.0001)).filter(r=>r.length >= 4);
    if(rings.length) out.push({ id: el.type + el.id, name: t.name || 'CHKO', rings });
  });
  return out;
}


const CHKO_RE = '(^|[^a-z])chko([^a-z]|$)|chr[aá]n[eěé]n[aá] krajinn[aá] oblas';
async function buildChko(){
  const bbox = bboxStr(REGION);
  const keys = '^(name|official_name|protection_title|protection_title:cs|designation)$';
  const q = `[out:json][timeout:180];(` +
    `relation["boundary"="protected_area"][~"${keys}"~"${CHKO_RE}",i](${bbox});` +
    `way["boundary"="protected_area"][~"${keys}"~"${CHKO_RE}",i](${bbox});` +
    `relation["leisure"="nature_reserve"][~"${keys}"~"${CHKO_RE}",i](${bbox});` +
    `);out geom;`;
  const d = await overpass(q);
  return parseElements(d.elements);
}
// ---- benzínky: stejné zpracování jako public/fuel.js ----
async function buildFuel(){
  const acc = [];
  for(const box of stripes(3)){
    const b = bboxStr(box);
    const d = await overpass(`[out:json][timeout:120];(node["amenity"="fuel"](${b});way["amenity"="fuel"](${b}););out center tags;`);
    (d.elements || []).forEach(el=>{
      const t = el.tags || {};
      const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
      const lon = el.lon != null ? el.lon : (el.center && el.center.lon);
      if(lat == null || lon == null) return;
      acc.push([el.type[0] + el.id, +lat.toFixed(6), +lon.toFixed(6), t.name || '', t.brand || t.operator || '', t.opening_hours || '']);
    });
  }
  return acc;
}
const BUILDERS = { chko: buildChko, fuel: buildFuel };

function mount(app, { pool }){
  let ready = null;
  const ensure = () => ready || (ready = pool.query(SCHEMA).catch(e => { ready = null; throw e; }));
  const building = {};
  function rebuild(kind){
    if(building[kind]) return building[kind];
    building[kind] = (async ()=>{
      const data = await BUILDERS[kind]();
      if(!Array.isArray(data) || !data.length) throw new Error('prázdná data');
      const text = JSON.stringify(data);
      await pool.query(`INSERT INTO region_cache (kind, data, updated_at) VALUES ($1, $2, now())
                        ON CONFLICT (kind) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [kind, text]);
      return { t: Date.now(), text };
    })().finally(()=>{ delete building[kind]; });
    return building[kind];
  }
  app.get('/api/region/:kind', async (req, res) => {
    const kind = req.params.kind;
    if(!BUILDERS[kind]) return res.status(404).json({ error: 'Neznámá data.' });
    try{
      await ensure();
      const r = await pool.query('SELECT data, updated_at FROM region_cache WHERE kind = $1', [kind]);
      const row = r.rows[0];
      if(row){
        const t = new Date(row.updated_at).getTime();
        if(Date.now() - t > MAX_AGE_MS) rebuild(kind).catch(e => console.error('region rebuild', kind, e.message));   // obnova na pozadí
        res.set('Cache-Control', 'public, max-age=3600');
        res.type('application/json').send('{"t":' + t + ',"data":' + row.data + '}');
        return;
      }
      const built = await rebuild(kind);   // první stažení – počká se
      res.type('application/json').send('{"t":' + built.t + ',"data":' + built.text + '}');
    }catch(e){
      console.error('region', kind, e.message);
      res.status(503).json({ error: 'Data teď nejdou připravit (' + e.message + ').' });
    }
  });
  // po startu serveru je připravit předem (ať první uživatel nečeká)
  setTimeout(async ()=>{
    try{
      await ensure();
      for(const kind of Object.keys(BUILDERS)){
        const r = await pool.query('SELECT updated_at FROM region_cache WHERE kind = $1', [kind]);
        if(!r.rows[0] || Date.now() - new Date(r.rows[0].updated_at).getTime() > MAX_AGE_MS)
          await rebuild(kind).catch(e => console.error('region prebuild', kind, e.message));
      }
    }catch(e){ console.error('region init', e.message); }
  }, 15000);
}
module.exports = { mount, _test: { parseElements, joinRings, simplify, BUILDERS } };
