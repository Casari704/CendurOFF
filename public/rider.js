// ---------------------------------------------------------------
// CendurOFF – profil jezdce (v4.3): odznaky podle najetých km a počítadlo km
//
//  CendurRider.BADGES / RANKS      – 6 hodností podle km (v4.4)
//  CendurRider.ACHIEVEMENTS        – sběratelské odznaky; achievements(stats) → got + postup
//  CendurRider.checkNew()          – okno „Nový odznak“ (jednou za účet, ne během jízdy)
//  CendurRider.badgeFor(km)        – { icon, name, km, next, toNext, pct }
//  CendurRider.track(pos)          – skutečná poloha GPS z navigace / záznamu jízdy
//                                    (simulaci a dopočtenou polohu sem neposílat)
//  CendurRider.flush()             – odeslat nasbírané metry hned
//
// Km se počítají z přesných poloh (≤ 35 m), bez skoků a mezer; na server se posílají po
// dávkách (1 km / 60 s, a když se stránka schová). Server má vlastní strop proti nesmyslům.
// ---------------------------------------------------------------
(function(){
  // v4.4: hodnost podle najetých km (má se vždy jen ta nejvyšší dosažená)
  const BADGES = [
    { km:0,    icon:'🔰', name:'Bažant' },
    { km:10,   icon:'⚙️', name:'Zelenáč' },
    { km:100,  icon:'🧭', name:'Průzkumník' },
    { km:500,  icon:'🐗', name:'Cestovatel' },
    { km:1500, icon:'🐺', name:'Šedý vlk' },
    { km:5000, icon:'🏆', name:'Legenda CendurOFF' }
  ];
  const RANKS = BADGES;
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

  // v4.4: sběratelské odznaky – každý jen jednou; čísla (stats) počítá server (profile-api.js)
  //  need: [klíč ve stats, potřeba, popis podmínky]
  const ACHIEVEMENTS = [
    { id:'stopar',    icon:'👣', name:'Stopař',          desc:'Nahrál aspoň 2 trasy ze záznamu své jízdy v Atlasu.',
      need:[['recRoutes', 2, 'tras ze záznamu jízdy']] },
    { id:'fotograf',  icon:'📸', name:'Fotograf',        desc:'Nahrál fotky aspoň ke 2 svým trasám.',
      need:[['photoRoutes', 2, 'tras s fotkami']] },
    { id:'ledoborec', icon:'🧊', name:'Ledoborec',       desc:'Projel trasu mezi listopadem a únorem.',
      need:[['winterRides', 1, 'zimní projetí']] },
    { id:'dakarista', icon:'🏁', name:'Dakarista',       desc:'Projel aspoň 2 trasy podle roadbooku (Roadbook NAVI, bez simulace).',
      need:[['rbRides', 2, 'tras podle roadbooku']] },
    { id:'recenzent', icon:'⭐', name:'Recenzent',       desc:'Napsal 5 recenzí k trasám, které opravdu projel.',
      need:[['reviewsRidden', 5, 'recenzí projetých tras']] },
    { id:'prukopnik', icon:'🥇', name:'Průkopník',       desc:'Jako první (kromě autora) projel něčí trasu.',
      need:[['pioneer', 1, 'trasa projetá jako první']] },
    { id:'pruvodce',  icon:'🏡', name:'Místní průvodce', desc:'Nahrál aspoň 5 tras, projel aspoň 5 tras a jeho trasu projel někdo jiný.',
      need:[['ownRoutes', 5, 'nahraných tras'], ['ridden', 5, 'projetých tras'], ['ownRiddenByOthers', 1, 'trasa projetá ostatními']] },
    { id:'kartograf', icon:'🗺️', name:'Kartograf',       desc:'Nahrál aspoň 10 tras a 8 z nich projel někdo jiný.',
      need:[['ownRoutes', 10, 'nahraných tras'], ['ownRiddenByOthers', 8, 'tras projetých ostatními']] },
    { id:'rbautor',   icon:'📜', name:'Dakar Navigátor', desc:'Jeho roadbook je Ready a někdo jiný podle něj trasu projel.',
      need:[['rbAuthor', 1, 'roadbook projetý ostatními']] }
  ];
  // [{ ...odznak, got, parts:[{cur, need, label}], pct }]
  function achievements(stats){
    stats = stats || {};
    return ACHIEVEMENTS.map(a => {
      const parts = a.need.map(([k, n, label]) => ({ cur: Math.min(n, Number(stats[k]) || 0), need: n, label }));
      const got = parts.every(p => p.cur >= p.need);
      const pct = Math.round(parts.reduce((t, p) => t + p.cur / p.need, 0) / parts.length * 100);
      return Object.assign({}, a, { got, parts, pct });
    });
  }
  // všechno, co uživatel má: id pro hodnost 'rank:<km>' (Bažant se nepočítá – má ho každý) + id odznaků
  function earnedIds(p){
    const ids = [];
    BADGES.forEach(b => { if(b.km > 0 && (Number(p.km) || 0) >= b.km) ids.push('rank:' + b.km); });
    achievements(p.stats).forEach(a => { if(a.got) ids.push(a.id); });
    return ids;
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

  // ---------- v4.4: okno „Získal jsi odznak“ (jednou za účet – co už viděl, si pamatuje server) ----------
  const API = () => window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
  let checking = false, lastCheck = 0;
  function riding(){
    const b = document.body;
    if(b.classList.contains('nav-on') || document.querySelector('.rec-on')) return true;   // Atlas: navigace / záznam jízdy
    const r = document.getElementById('nv-ride');                                     // Roadbook NAVI: jízda
    return !!(r && r.classList.contains('open'));
  }
  async function checkNew(){
    if(checking || !token() || Date.now() - lastCheck < 60000) return;
    if(riding() || (window.CendurHeader && window.CendurHeader.askOpen && window.CendurHeader.askOpen())) return;
    checking = true; lastCheck = Date.now();
    try{
      const h = { Authorization:'Bearer ' + token() };
      const r = await fetch(API() + '/api/profile', { credentials:'include', headers:h });
      if(!r.ok) return;
      const p = await r.json();
      const seen = new Set(p.seen || []);
      const fresh = earnedIds(p).filter(id => !seen.has(id));
      if(!fresh.length || riding() || !window.CendurHeader || !window.CendurHeader.ask) return;
      const list = fresh.map(id => {
        if(id.startsWith('rank:')){ const b = BADGES.find(x => 'rank:' + x.km === id); return b && { icon:b.icon, name:b.name, rank:true, desc:'Nová hodnost – najeto přes ' + fmtKm(b.km) + '.' }; }
        const a = ACHIEVEMENTS.find(x => x.id === id); return a && { icon:a.icon, name:a.name, desc:a.desc };
      }).filter(Boolean);
      // u hodností stačí ukázat tu nejvyšší novou
      const ranks = list.filter(x => x.rank);
      const shown = list.filter(x => !ranks.includes(x)).concat(ranks.slice(-1));
      const one = shown.length === 1;
      window.CendurHeader.ask({
        icon: one ? shown[0].icon : '🎉',
        title: one ? (shown[0].rank ? 'Nová hodnost: ' : 'Nový odznak: ') + shown[0].name : 'Získal jsi ' + shown.length + (shown.length < 5 ? ' odznaky!' : ' odznaků!'),
        msg: one ? shown[0].desc : 'Gratulujeme! Za jízdy a aktivitu na CendurOFF ti patří:',
        list: one ? null : shown,
        yes: { label:'OK' },
        no: { label:'Moje odznaky', fn: () => { location.href = 'nastaveni.html#odznaky'; } }
      });
      fetch(API() + '/api/profile/seen', { method:'POST', credentials:'include', headers:Object.assign({ 'Content-Type':'application/json' }, h), body: JSON.stringify({ ids: fresh }) }).catch(() => {});
    }catch(e){ /* bez signálu – zkusí se příště */ }
    finally{ checking = false; }
  }
  // po načtení stránky, po návratu do aplikace a po skončení jízdy (kontroluje se nejvýš 1× za minutu)
  window.addEventListener('load', () => setTimeout(checkNew, 2500));
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') setTimeout(checkNew, 1500); });
  setInterval(() => { if(!riding()) checkNew(); }, 5 * 60000);

  window.CendurRider = { BADGES, RANKS, ACHIEVEMENTS, badgeFor, achievements, earnedIds, fmtKm, track, flush, checkNew };
})();
