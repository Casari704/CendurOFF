// CendurOFF – doplnění nadmořské výšky k trasám, které ji nemají (v4.49)
// Záznam jízdy z telefonu (Stopař) často výšku z GPS nemá → převýšení 0 m a žádný výškový profil.
// Výšky se doplní z digitálního modelu terénu přes Open-Meteo Elevation API (Copernicus DEM, zdarma,
// až 100 bodů v jednom dotazu). U dlouhých tras se vezme nejvýš ~3000 bodů a mezi nimi se dopočítá.
const API = 'https://api.open-meteo.com/v1/elevation';
const MAX_SAMPLES = 3000, PER_REQ = 100;

// má trasa výšky? (aspoň polovina bodů s rozumnou výškou, ne všechny stejné)
function hasElevation(points){
  let ok = 0, min = Infinity, max = -Infinity;
  points.forEach(p => { const e = p[2]; if(e != null && Number.isFinite(e) && e !== 0){ ok++; if(e < min) min = e; if(e > max) max = e; } });
  return ok >= points.length * 0.5 && max - min > 0.5;
}

async function fetchBatch(lats, lons, timeoutMs){
  const url = API + '?latitude=' + lats.map(v => v.toFixed(5)).join(',') + '&longitude=' + lons.map(v => v.toFixed(5)).join(',');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try{
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'CendurOFF/1.0 (cenduroff.cz)' } });
    if(!r.ok) throw new Error('elevation ' + r.status);
    const j = await r.json();
    if(!Array.isArray(j.elevation) || j.elevation.length !== lats.length) throw new Error('elevation: neplatná odpověď');
    return j.elevation;
  } finally { clearTimeout(t); }
}

// vrátí nové pole bodů s doplněnou výškou (nebo původní, když se to nepovede); deadline v ms celkem
async function fillElevation(points, deadlineMs){
  if(!Array.isArray(points) || points.length < 2 || hasElevation(points)) return points;
  const t0 = Date.now(), n = points.length;
  const step = Math.max(1, Math.ceil(n / MAX_SAMPLES));
  const idx = [];
  for(let i = 0; i < n; i += step) idx.push(i);
  if(idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  const ele = new Array(idx.length);
  for(let k = 0; k < idx.length; k += PER_REQ){
    const part = idx.slice(k, k + PER_REQ);
    const left = (deadlineMs || 20000) - (Date.now() - t0);
    if(left < 1500) return points;   // nestihli jsme – trasa se uloží bez výšek
    const res = await fetchBatch(part.map(i => points[i][0]), part.map(i => points[i][1]), Math.min(10000, left));
    res.forEach((e, j) => { ele[k + j] = Number.isFinite(e) ? e : null; });
  }
  // mezi vzorky lineárně dopočítat
  const out = points.map(p => [p[0], p[1], null]);
  for(let k = 0; k < idx.length; k++){
    out[idx[k]][2] = ele[k];
    if(k > 0 && ele[k] != null && ele[k - 1] != null){
      const a = idx[k - 1], b = idx[k];
      for(let i = a + 1; i < b; i++) out[i][2] = +(ele[k - 1] + (ele[k] - ele[k - 1]) * (i - a) / (b - a)).toFixed(1);
    }
  }
  return out;
}

// převýšení z výšek z modelu terénu: mírné vyhlazení (±2 body), ať schody mřížky modelu nesčítají šum
function gainOf(points){
  const e = points.map(p => p[2]);
  let gain = 0, prev = null;
  for(let i = 0; i < e.length; i++){
    let s = 0, c = 0;
    for(let j = Math.max(0, i - 2); j <= Math.min(e.length - 1, i + 2); j++) if(e[j] != null){ s += e[j]; c++; }
    if(!c) continue;
    const v = s / c;
    if(prev != null && v > prev) gain += v - prev;
    prev = v;
  }
  return gain;
}

// na pozadí: doplnit výšky u uložených tras, které je nemají (po startu serveru, po jedné)
function mount(app, { pool }){
  setTimeout(async () => {
    try{
      const r = await pool.query("SELECT id, points FROM routes WHERE deleted_at IS NULL");
      for(const row of r.rows){
        const pts = row.points;
        if(!Array.isArray(pts) || pts.length < 2 || hasElevation(pts)) continue;
        try{
          const filled = await fillElevation(pts, 60000);
          if(filled === pts || !hasElevation(filled)) continue;
          await pool.query('UPDATE routes SET points = $1, elev_gain_m = $2 WHERE id = $3', [JSON.stringify(filled), gainOf(filled), row.id]);
          console.log('Výšky doplněny k trase', row.id);
        }catch(e){ console.error('výšky trasy', row.id, e.message); }
        await new Promise(r2 => setTimeout(r2, 2000));
      }
    }catch(e){ console.error('výšky – kontrola tras', e.message); }
  }, 45000);
}

module.exports = { mount, fillElevation, hasElevation, gainOf };
