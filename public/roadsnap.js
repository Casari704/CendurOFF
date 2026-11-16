// ---------------------------------------------------------------
// Přichycení šipky na cestu (v4.52) – jako Google / Mapy.com
// GPS v telefonu běžně uhýbá o 5–10 m do strany; šipka se proto za jízdy kreslí na nejbližší cestu
// z OpenStreetMap, po které jedu (do 20 m a jejím směrem). Záznam jízdy a najeté km dál používají
// skutečnou polohu z GPS – mění se jen to, kde se kreslí šipka.
// Cesty po dlaždicích 0,02° ze serveru (/api/osm/roads/x_y), v paměti nejvýš ~30 dlaždic.
// ---------------------------------------------------------------
(function(){
  const S = 0.02, MAX_M = 20, KEEP = 30;
  const tiles = new Map();        // tile -> { segs:[[ax,ay,bx,by,wayId,type]], t } | 'loading' | { retryAt }
  let lastWay = null, kx = 0, lat0 = null;
  const ky = 111320;
  const api = () => window.CENDUROFF_API_URL || 'https://api.cenduroff.cz';

  function setProj(lat){ if(lat0 == null || Math.abs(lat - lat0) > 0.5){ lat0 = lat; kx = 111320 * Math.cos(lat * Math.PI / 180); tiles.clear(); } }
  function tileOf(lat, lon){ return Math.floor(lon / S + 1e-9) + '_' + Math.floor(lat / S + 1e-9); }

  async function load(tile){
    tiles.set(tile, 'loading');
    try{
      const res = await fetch(api() + '/api/osm/roads/' + tile);
      if(res.status === 202){ tiles.set(tile, { retryAt: Date.now() + 15000 }); return; }
      if(!res.ok) throw new Error('server ' + res.status);
      const ways = await res.json(), segs = [];
      ways.forEach((w, wi) => {
        const type = w[0]; let la = 0, lo = 0, px = null, py = null;
        for(let i = 1; i < w.length; i += 2){
          la += w[i]; lo += w[i + 1];
          const x = lo / 1e5 * kx, y = la / 1e5 * ky;
          if(px != null) segs.push([px, py, x, y, tile + ':' + wi, type]);
          px = x; py = y;
        }
      });
      tiles.set(tile, { segs, t: Date.now() });
      if(tiles.size > KEEP){   // nejstarší pryč
        const old = [...tiles.entries()].filter(e => e[1] && e[1].t).sort((a, b) => a[1].t - b[1].t);
        old.slice(0, tiles.size - KEEP).forEach(e => tiles.delete(e[0]));
      }
    }catch(e){ tiles.set(tile, { retryAt: Date.now() + 60000 }); }
  }
  function ensure(lat, lon){
    const cx = Math.floor(lon / S + 1e-9), cy = Math.floor(lat / S + 1e-9);
    for(let dx = -1; dx <= 1; dx++) for(let dy = -1; dy <= 1; dy++){
      const k = (cx + dx) + '_' + (cy + dy), v = tiles.get(k);
      if(v === 'loading' || (v && v.segs)) { if(v && v.segs) v.t = Date.now(); continue; }
      if(v && v.retryAt && Date.now() < v.retryAt) continue;
      load(k);
    }
  }
  function angleDiff(a, b){ let d = ((a - b) % 360 + 540) % 360 - 180; return d; }

  // latlng [lat, lon]; course = směr z GPS (nebo null při stání); vrací [lat, lon] na cestě, nebo null
  function snap(latlng, course, acc){
    const lat = latlng[0], lon = latlng[1];
    setProj(lat);
    ensure(lat, lon);
    if(acc != null && acc > 35) return null;
    const px = lon * kx, py = lat * ky;
    const m = 1 / ky * MAX_M;   // ~MAX_M ve stupních šířky
    const near = new Set([tileOf(lat, lon), tileOf(lat + m, lon), tileOf(lat - m, lon), tileOf(lat, lon + m * 1.6), tileOf(lat, lon - m * 1.6)]);
    let best = null, bestScore = Infinity, bestWay = null;
    near.forEach(k => {
      const v = tiles.get(k); if(!v || !v.segs) return;
      for(const s of v.segs){
        const [ax, ay, bx, by, way, type] = s;
        if(Math.min(ax, bx) - MAX_M > px || Math.max(ax, bx) + MAX_M < px || Math.min(ay, by) - MAX_M > py || Math.max(ay, by) + MAX_M < py) continue;
        const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
        let t = L2 ? ((px - ax) * vx + (py - ay) * vy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const qx = ax + t * vx, qy = ay + t * vy, d = Math.hypot(qx - px, qy - py);
        if(d > MAX_M) continue;
        if(course != null && L2 > 1){   // jedu po cestě (tam nebo zpět), ne napříč přes ni
          const brg = (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360, diff = Math.abs(angleDiff(course, brg));
          if(diff > 40 && diff < 140) continue;
        }
        // cesta, na které už šipka je, má přednost (ať neskáče na souběžnou); pěšiny až nakonec
        const score = d - (way === lastWay ? 6 : 0) + (type >= 7 ? 4 : 0);
        if(score < bestScore){ bestScore = score; best = [qy / ky, qx / kx]; bestWay = way; }
      }
    });
    lastWay = bestWay;
    return best;
  }
  window.CendurRoadSnap = { snap, reset(){ lastWay = null; } };
})();
