// ---------------------------------------------------------------
// CendurOFF – profil jezdce (v4.3): odznaky podle najetých km a počítadlo km
//
//  CendurRider.BADGES              – 5 odznaků (od 0 km)
//  CendurRider.badgeFor(km)        – { icon, name, km, next, toNext, pct }
//  CendurRider.track(pos)          – skutečná poloha GPS z navigace / záznamu jízdy
//                                    (simulaci a dopočtenou polohu sem neposílat)
//  CendurRider.flush()             – odeslat nasbírané metry hned
//
// Km se počítají z přesných poloh (≤ 35 m), bez skoků a mezer; na server se posílají po
// dávkách (1 km / 60 s, a když se stránka schová). Server má vlastní strop proti nesmyslům.
// ---------------------------------------------------------------
(function(){
  const BADGES = [
    { km:0,    icon:'🔰', name:'Nováček' },
    { km:100,  icon:'🟫', name:'Prašák' },
    { km:500,  icon:'🐗', name:'Bahňák' },
    { km:1500, icon:'🐺', name:'Enduro vlk' },
    { km:5000, icon:'🏆', name:'Legenda CendurOFF' }
  ];
  function badgeFor(km){
    km = Number(km) || 0;
    let i = 0;
    for(let k = 0; k < BADGES.length; k++) if(km >= BADGES[k].km) i = k;
    const b = BADGES[i], next = BADGES[i + 1] || null;
    return Object.assign({}, b, {
      level: i + 1,
      next,
      toNext: next ? Math.max(0, next.km - km) : 0,
      pct: next ? Math.min(100, Math.round((km - b.km) / (next.km - b.km) * 100)) : 100
    });
  }
  function fmtKm(km){ km = Number(km) || 0; return (km >= 100 ? Math.round(km) : Math.round(km * 10) / 10).toLocaleString('cs-CZ') + ' km'; }

  // ---------- počítadlo km ----------
  const ACC_MAX = 35, MAX_SPEED = 60, GAP_MS = 30000, FLUSH_M = 1000, FLUSH_MS = 60000;
  let last = null, pending = 0, lastFlush = Date.now(), sending = false;
  function hav(a, b){
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function token(){ try{ return localStorage.getItem('cenduroff.token'); }catch(e){ return null; } }
  function track(pos){
    if(!pos || pos.predicted || !pos.coords) return;
    const c = pos.coords;
    if(!(c.accuracy <= ACC_MAX)) return;
    const now = Date.now(), p = [c.latitude, c.longitude];
    if(last && now - last.t < GAP_MS){
      const d = hav(last.p, p), dt = (now - last.t) / 1000;
      if(d / Math.max(dt, 0.5) > MAX_SPEED) return;           // skok – bod zahodit, starý ponechat
      if(d < Math.max(5, c.accuracy / 2)) return;              // šum na místě – počkat na větší posun
      pending += d;
    }
    last = { p, t: now };
    if(pending >= FLUSH_M || (pending > 50 && now - lastFlush > FLUSH_MS)) flush();
  }
  function flush(keepalive){
    if(sending || pending < 10 || !token()) return;
    const m = Math.round(pending);
    pending = 0; lastFlush = Date.now(); sending = true;
    const api = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
    fetch(api + '/api/profile/km', {
      method:'POST', credentials:'include', keepalive: !!keepalive,
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token() },
      body: JSON.stringify({ meters: m })
    }).then(r => { if(!r.ok && r.status >= 500) pending += m; })
      .catch(() => { pending += m; })                          // bez signálu – zkusí se příště
      .finally(() => { sending = false; });
  }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('pagehide', () => flush(true));

  window.CendurRider = { BADGES, badgeFor, fmtKm, track, flush };
})();
