// ---------------------------------------------------------------
// CendurOFF – počítání projetí tras (v2.5), společné pro Atlas NAVI a Roadbook NAVI
//
// Telefon si sám u sebe značí, kolem kterých míst trasy projel (do 35 m). Body trasy jsou
// po ~50 m. Jakmile je projetých aspoň 20 % trasy, pošle na server jen „trasa X projeta“
// (žádnou polohu ani stopu). Server započítá nejvýš jedno projetí za 24 h na uživatele a trasu.
// Rozjetá jízda se pamatuje v prohlížeči 24 h (přežije zavření aplikace).
// ---------------------------------------------------------------
(function(){
  const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
  const STORE_KEY = 'cenduroff.rides.v1';
  const NODE_STEP = 50;          // m – vzdálenost bodů trasy pro počítání pokrytí
  const HIT_M = 35;              // m – jak blízko musí jezdec bodu projet
  const MIN_COVERAGE = 0.2;      // 20 % trasy
  const WINDOW_MS = 24 * 3600 * 1000;
  const D2R = Math.PI / 180;

  let routes = new Map();        // id -> { id, lat[], lon[], bbox }
  let state = load();            // { cov: { id: { t0, hits: [indexy] } }, sent: { id: čas } }
  let dirty = false;

  function load(){
    try{ const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if(s && s.cov && s.sent) return s; }catch(e){}
    return { cov: {}, sent: {} };
  }
  function save(){
    if(!dirty) return; dirty = false;
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }catch(e){}
  }
  setInterval(save, 10000);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') save(); });

  function hav(a1, o1, a2, o2){
    const dLat = (a2 - a1) * D2R, dLon = (o2 - o1) * D2R;
    const s = Math.sin(dLat/2)**2 + Math.cos(a1*D2R) * Math.cos(a2*D2R) * Math.sin(dLon/2)**2;
    return 2 * 6371000 * Math.asin(Math.sqrt(s));
  }
  // body trasy po ~50 m
  function prepare(r){
    const pts = (r.points || []).filter(p => p && isFinite(p[0]) && isFinite(p[1]));
    if(pts.length < 2) return null;
    const lat = [pts[0][0]], lon = [pts[0][1]];
    let acc = 0;
    for(let i = 1; i < pts.length; i++){
      const a = pts[i-1], b = pts[i], d = hav(a[0], a[1], b[0], b[1]);
      if(d <= 0) continue;
      let t = NODE_STEP - acc;
      while(t <= d){ const f = t / d; lat.push(a[0] + (b[0]-a[0])*f); lon.push(a[1] + (b[1]-a[1])*f); t += NODE_STEP; }
      acc = d - (t - NODE_STEP);
    }
    const last = pts[pts.length - 1]; lat.push(last[0]); lon.push(last[1]);
    let s = 90, n = -90, w = 180, e = -180;
    lat.forEach(v => { if(v < s) s = v; if(v > n) n = v; });
    lon.forEach(v => { if(v < w) w = v; if(v > e) e = v; });
    const pad = 0.0006;
    return { id: r.id, lat, lon, bbox: [s - pad, w - pad, n + pad, e + pad] };
  }

  function setRoutes(list){
    const next = new Map();
    (list || []).forEach(r => {
      if(!r || r.id == null) return;
      const old = routes.get(r.id);
      if(old && old.src === r.points) { next.set(r.id, old); return; }
      const p = prepare(r);
      if(p){ p.src = r.points; next.set(r.id, p); }
    });
    routes = next;
  }

  async function report(id, coverage, source){
    let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
    const o = { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ coverage, source }) };
    if(t) o.headers.Authorization = 'Bearer ' + t;
    const res = await fetch(API_URL + '/api/routes/' + id + '/ride', o);
    if(!res.ok && res.status !== 400 && res.status !== 404) throw new Error('server ' + res.status);
  }
  const pending = new Set();
  const lastTry = {};

  // zavolat při každé poloze z GPS během navigace / záznamu jízdy
  function track(lat, lon, source){
    if(!isFinite(lat) || !isFinite(lon)) return;
    const now = Date.now();
    const cosLat = Math.cos(lat * D2R), dLat = HIT_M / 110540, dLon = HIT_M / (111320 * cosLat);
    routes.forEach(r => {
      const b = r.bbox;
      if(lat < b[0] || lat > b[2] || lon < b[1] || lon > b[3]) return;
      const sent = state.sent[r.id];
      if(sent && now - sent < WINDOW_MS) return;          // za posledních 24 h už započítáno
      let c = state.cov[r.id];
      if(!c || now - c.t0 > WINDOW_MS){ c = state.cov[r.id] = { t0: now, hits: [] }; }
      const hits = new Set(c.hits);
      let added = false;
      for(let i = 0; i < r.lat.length; i++){
        if(hits.has(i)) continue;
        const dy = r.lat[i] - lat, dx = r.lon[i] - lon;
        if(Math.abs(dy) > dLat || Math.abs(dx) > dLon) continue;
        if(hav(lat, lon, r.lat[i], r.lon[i]) <= HIT_M){ hits.add(i); added = true; }
      }
      if(added){ c.hits = Array.from(hits); dirty = true; }
      const coverage = hits.size / r.lat.length;
      // odeslat hned po překročení 20 %; když to nevyjde (bez signálu), zkusit znovu nejdřív za minutu
      if(coverage >= MIN_COVERAGE && !pending.has(r.id) && (added || now - (lastTry[r.id] || 0) > 60000)){
        lastTry[r.id] = now;
        pending.add(r.id);
        report(r.id, coverage, source).then(() => {
          state.sent[r.id] = Date.now(); delete state.cov[r.id]; dirty = true; save();
        }).catch(() => { /* bez signálu – zkusí se při další poloze */ }).finally(() => pending.delete(r.id));
      }
    });
    // úklid starých záznamů
    Object.keys(state.sent).forEach(k => { if(now - state.sent[k] > WINDOW_MS) { delete state.sent[k]; dirty = true; } });
  }

  window.CendurRides = { setRoutes, track, MIN_COVERAGE };
})();
