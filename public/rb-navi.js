(function(){
// ===============================================================
// CendurOFF – Roadbook NAVI (roadbook-navi.html), v2.0
//
// Jízda podle roadbooku: poloha z GPS se promítá na trasu, z toho počítadlo km,
// odpočet do další instrukce a posun krabiček (nové přijíždějí shora, aktuální je
// dole nad odpočtem). Trasy a roadbooky jen čte.
// ===============================================================
const RB = window.CendurRB;
const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
const $ = id => document.getElementById(id);
const esc = RB.esc;

const OFF_ROUTE_M = 50;        // dál od trasy = upozornění „mimo trasu“
const PASS_M = 8;              // instrukce je projetá, když jsme za ní o tolik metrů
const WARN_M = 100;            // zavibrovat 100 m před instrukcí
const BACK_WINDOW = 200, FWD_WINDOW = 1500;   // kde hledat polohu na trase vůči minulé

function toast(msg, ms){
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._h); toast._h = setTimeout(()=>{ t.style.display = 'none'; }, ms || 3200);
}
window.toast = window.toast || toast;
async function api(url, options){
  const o = Object.assign({ credentials:'include' }, options);
  let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
  if(t) o.headers = Object.assign({}, o.headers, { Authorization:'Bearer ' + t });
  const res = await fetch(API_URL + url, o);
  let data = null, isJson = false;
  try{ data = await res.json(); isJson = true; }catch(e){}
  if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
  if(!isJson) throw new Error('Server neodpověděl správně (zkus to prosím za chvíli).');
  return data;
}
function busy(text){ $('rb-busy-text').textContent = text || 'Pracuji…'; $('rb-busy').classList.add('open'); }
function unbusy(){ $('rb-busy').classList.remove('open'); }
(function patchHeader(){ const sub = document.querySelector('header.topbar .brand-sub'); if(sub) sub.textContent = 'Roadbook NAVI'; })();

// ---------------------------------------------------------------
// Výběr trasy
// ---------------------------------------------------------------
let currentUser = null, routes = [], sums = {};
function renderSelect(){
  const q = ($('nv-search').value || '').trim().toLowerCase();
  const list = routes.filter(r => !q || r.name.toLowerCase().includes(q));
  const groups = [
    ['Roadbook READY', list.filter(r => sums[r.id] && sums[r.id].status === 'ready'), 'ready', 'READY'],
    ['Rozpracované (NOT ready)', list.filter(r => sums[r.id] && sums[r.id].status !== 'ready'), 'draft', 'NOT READY'],
    ['Bez roadbooku – vygeneruje se automaticky', list.filter(r => !sums[r.id]), 'none', 'AUTO']
  ];
  $('nv-list').innerHTML = groups.filter(g => g[1].length).map(g => '<h2>' + g[0] + '</h2>' +
    '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">' + g[1].map(r =>
      '<button type="button" class="nv-route" data-id="' + r.id + '"><b>' + esc(r.name) + '</b><span>' + (+r.distance_km).toFixed(1).replace('.', ',') + ' km</span><span class="rb-badge ' + g[2] + '">' + g[3] + '</span></button>').join('') + '</div>').join('') ||
    '<p class="sub">Žádná trasa.</p>';
  $('nv-list').querySelectorAll('.nv-route').forEach(b => b.addEventListener('click', () => startRide(Number(b.dataset.id))));
}
$('nv-search').addEventListener('input', renderSelect);

// ---------------------------------------------------------------
// Jízda – stav
// ---------------------------------------------------------------
let route = null, R = null, vis = [];
let prog = null;          // poloha na trase (m), null = zatím nevíme
let offset = 0;           // ruční korekce počítadla (±10 m)
let curIdx = -1, warned = {};
let watchId = null, wakeLock = null, sim = null;
let mini = null, miniMe = null, big = null, bigMe = null;
let heading = null, speed = 0;

function odo(){ return prog == null ? 0 : Math.max(0, Math.min(R.total, prog + offset)); }

async function startRide(id){
  const r = routes.find(x => x.id === id);
  if(!r) return;
  route = r;
  try{ R = RB.prepareRoute(r.points); }catch(e){ toast(e.message); return; }
  let items = null;
  try{
    busy('Načítám roadbook…');
    const res = await api('/api/roadbooks/' + id);
    if(res.roadbook && res.roadbook.data && Array.isArray(res.roadbook.data.items)){
      items = res.roadbook.data.items.map(x => Object.assign({ sides: [], icons: [] }, x));
      if(res.roadbook.stale){
        // trasa se změnila – instrukce přeneseme na novou geometrii, ať km sedí
        items = RB.reproject(R, items);
        toast('Pozor: trasa se od uložení roadbooku změnila, roadbook není zkontrolovaný.', 6000);
      } else if(res.roadbook.status !== 'ready'){
        toast('Roadbook téhle trasy ještě není označený jako hotový (NOT ready).', 4500);
      }
    }
    if(!items){
      $('rb-busy-text').textContent = 'Generuji roadbook…';
      const g = await RB.generate(r.points, { useOsm: true, onProgress: t => { $('rb-busy-text').textContent = t; } });
      items = g.items;
      toast('Roadbook vygenerován automaticky – není zkontrolovaný.', 5000);
    }
  }catch(e){
    toast('Roadbook se nepodařilo načíst: ' + e.message, 6000); unbusy(); return;
  }finally{ unbusy(); }
  RB.recompute(R, items);
  vis = RB.visible(items);
  prog = null; offset = 0; curIdx = -1; warned = {}; heading = null; speed = 0;
  $('nv-ride').classList.add('open');
  try{ history.replaceState(null, '', location.pathname + '?trasa=' + id); }catch(e){}
  setupMaps();
  render(true);
  requestWakeLock();
  if($('nv-simopt').checked) startSim(); else startGps();
}

function stopRide(){
  if(watchId != null){ navigator.geolocation.clearWatch(watchId); watchId = null; }
  stopSim();
  if(wakeLock){ try{ wakeLock.release(); }catch(e){} wakeLock = null; }
  $('nv-ride').classList.remove('open');
  $('nv-bigmap').classList.remove('open');
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
}
$('nv-end').addEventListener('click', () => { if(confirm('Ukončit jízdu podle roadbooku?')) stopRide(); });
$('nv-minus').addEventListener('click', () => { offset -= 10; render(false); });
$('nv-plus').addEventListener('click', () => { offset += 10; render(false); });

async function requestWakeLock(){
  if(!('wakeLock' in navigator)) return;
  try{ wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && $('nv-ride').classList.contains('open')) requestWakeLock(); });

// ---------------------------------------------------------------
// GPS
// ---------------------------------------------------------------
function startGps(){
  if(!navigator.geolocation){ toast('Prohlížeč nepodporuje GPS.'); return; }
  $('nv-wait').classList.add('open');
  watchId = navigator.geolocation.watchPosition(pos => {
    $('nv-wait').classList.remove('open');
    const c = pos.coords;
    speed = (c.speed != null && !isNaN(c.speed)) ? c.speed : 0;
    heading = (speed > 1.5 && c.heading != null && !isNaN(c.heading)) ? c.heading : null;
    onPosition(c.latitude, c.longitude);
  }, err => {
    if(err && err.code === 1){ toast('Bez povolení polohy NAVI nefunguje.', 5000); return; }
    $('nv-wait').classList.add('open');
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
}

function onPosition(lat, lon){
  let p = prog == null ? null : RB.project(R, lat, lon, Math.max(0, prog - BACK_WINDOW), Math.min(R.total, prog + FWD_WINDOW));
  if(!p || p.dist > 40){
    const g = RB.project(R, lat, lon);
    if(!p || g.dist + 15 < p.dist) p = g;
  }
  const off = p.dist > OFF_ROUTE_M;
  if(!off || prog == null) prog = p.s;
  // mimo trasu
  if(off){
    const q = RB.pointAt(R, p.s);
    const b = RB.bearing([lat, lon], q);
    const hdg = heading != null ? heading : (RB.bearingBetween(R, prog, Math.min(R.total, prog + 30)) || 0);
    $('nv-off-arrow').style.transform = 'rotate(' + Math.round(RB.angleDiff(b, hdg)) + 'deg)';
    $('nv-off-text').textContent = 'MIMO TRASU · ' + RB.fmtDist(p.dist);
  }
  $('nv-off').classList.toggle('open', off);
  updateMaps(lat, lon);
  render(false);
}

// ---------------------------------------------------------------
// Simulace (test u stolu)
// ---------------------------------------------------------------
const SIM_SPEEDS = [15, 30, 60, 120];
function startSim(){
  sim = { s: 0, kmh: 30, paused: false, t: null };
  $('nv-sim').classList.add('open');
  $('nv-sim-speed').textContent = sim.kmh + ' km/h';
  $('nv-sim-pause').textContent = '⏸ Pauza';
  sim.t = setInterval(() => {
    if(sim.paused) return;
    sim.s = Math.min(R.total, sim.s + sim.kmh / 3.6 * 0.5);
    const p = RB.pointAt(R, sim.s);
    speed = sim.kmh / 3.6;
    heading = RB.bearingBetween(R, sim.s, Math.min(R.total, sim.s + 20));
    onPosition(p[0], p[1]);
    if(sim.s >= R.total) sim.paused = true;
  }, 500);
}
function stopSim(){ if(sim && sim.t) clearInterval(sim.t); sim = null; $('nv-sim').classList.remove('open'); }
$('nv-sim-pause').addEventListener('click', () => { if(!sim) return; sim.paused = !sim.paused; $('nv-sim-pause').textContent = sim.paused ? '▶ Jet' : '⏸ Pauza'; });
$('nv-sim-speed').addEventListener('click', () => { if(!sim) return; sim.kmh = SIM_SPEEDS[(SIM_SPEEDS.indexOf(sim.kmh) + 1) % SIM_SPEEDS.length]; $('nv-sim-speed').textContent = sim.kmh + ' km/h'; });

// ---------------------------------------------------------------
// Mapy (minimapa v rohu + velká mapa)
// ---------------------------------------------------------------
function meIcon(){ return L.divIcon({ className:'', html:'<div class="nv-me"><img src="public/img/gps-arrow.png" alt=""></div>', iconSize:[34, 34], iconAnchor:[17, 17] }); }
function setupMaps(){
  const ll = R.lat.map((la, i) => [la, R.lon[i]]);
  if(!mini){
    mini = L.map('nv-mini', { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, touchZoom:false, boxZoom:false, keyboard:false, tap:false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(mini);
  }
  mini.eachLayer(l => { if(l instanceof L.Polyline || l instanceof L.Marker) mini.removeLayer(l); });
  L.polyline(ll, { color:'#4F7048', weight:6 }).addTo(mini);
  miniMe = L.marker(ll[0], { icon: meIcon(), keyboard:false, interactive:false }).addTo(mini);
  setTimeout(() => { mini.invalidateSize(); mini.setView(ll[0], 16); }, 60);
  if(!big){
    big = L.map('nv-bigmap-map', { zoomControl:true });
    L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', { maxZoom:19, maxNativeZoom:20, attribution:'© OpenStreetMap contributors, CyclOSM' }).addTo(big);
  }
  big.eachLayer(l => { if(l instanceof L.Polyline || l instanceof L.Marker) big.removeLayer(l); });
  L.polyline(ll, { color:'#4F7048', weight:6 }).addTo(big);
  vis.forEach(it => L.marker([it.lat, it.lon], { icon: L.divIcon({ className:'', html:'<div class="rb-mk' + (it.kind ? ' kind' : '') + '">' + (it.kind === 'start' ? 'S' : it.kind === 'finish' ? 'C' : it.n) + '</div>', iconSize:[26, 26], iconAnchor:[13, 13] }) })
    .bindTooltip(esc(RB.label(it))).addTo(big));
  bigMe = L.marker(ll[0], { icon: meIcon(), keyboard:false, interactive:false, zIndexOffset:2000 }).addTo(big);
}
function rotateMe(m){
  const el = m && m.getElement && m.getElement();
  const img = el && el.querySelector('img');
  if(img) img.style.transform = 'rotate(' + Math.round(heading != null ? heading : (RB.bearingBetween(R, odo(), Math.min(R.total, odo() + 30)) || 0)) + 'deg)';
}
function updateMaps(lat, lon){
  if(miniMe){ miniMe.setLatLng([lat, lon]); rotateMe(miniMe); mini.setView([lat, lon], mini.getZoom() || 16, { animate:false }); }
  if(bigMe){ bigMe.setLatLng([lat, lon]); rotateMe(bigMe); }
}
$('nv-mapbtn').addEventListener('click', () => {
  $('nv-bigmap').classList.add('open');
  setTimeout(() => {
    big.invalidateSize();
    const p = bigMe ? bigMe.getLatLng() : null;
    if(p && prog != null) big.setView(p, 15); else big.fitBounds(L.polyline(R.lat.map((la, i) => [la, R.lon[i]])).getBounds(), { padding:[20, 20] });
  }, 50);
});
$('nv-bigmap-close').addEventListener('click', () => $('nv-bigmap').classList.remove('open'));

// ---------------------------------------------------------------
// Vykreslení roadbooku
// ---------------------------------------------------------------
function cardHTML(it, cls){
  const icons = (it.icons || []).map(k => RB.iconSVG(k, 26)).join('');
  return '<div class="nv-card ' + cls + '">' +
    '<div class="nv-c1"><div class="n">#' + it.n + '</div><div class="t">' + RB.fmtKm(it.s) + '</div><div class="p">' + RB.fmtKm(it.par) + '</div></div>' +
    '<div class="nv-c2">' + RB.tulipSVG(it, 118) + '</div>' +
    '<div class="nv-c3"><div class="ic">' + RB.dangerHTML(it.danger) + icons + '</div>' +
    '<div class="l">' + esc(RB.label(it)) + '</div><div class="s">' + esc(RB.subLabel(it)) + '</div>' +
    (it.kind === 'finish' ? '' : '<div class="cap">' + (it.cap || 0) + '°</div>') + '</div></div>';
}
function render(force){
  if(!R) return;
  const o = odo();
  // další instrukce = první, ke které jsme ještě nedojeli
  let idx = vis.findIndex(it => it.s > o + PASS_M);
  if(idx < 0) idx = vis.length - 1;
  if(prog == null) idx = Math.min(1, vis.length - 1);
  if(force || idx !== curIdx){
    curIdx = idx;
    const from = Math.max(0, idx - 1), to = Math.min(vis.length - 1, idx + 5);
    let h = '';
    for(let i = to; i >= from; i--) h += cardHTML(vis[i], i < idx ? 'done' : i === idx ? 'cur' : 'next');
    // poslední projetá krabička je napůl schovaná dole; když žádná není, nic neschováváme
    $('nv-rows-inner').style.marginBottom = from < idx ? '' : '0';
    $('nv-rows-inner').innerHTML = h;
  }
  const nx = vis[idx], pv = vis[idx - 1];
  const dist = nx ? Math.max(0, nx.s - o) : 0;
  $('nv-km').textContent = RB.fmtKm(o);
  $('nv-par').textContent = RB.fmtKm(pv ? o - pv.s : o);
  const cap = heading != null ? heading : (prog != null ? RB.bearingBetween(R, o, Math.min(R.total, o + 30)) : null);
  $('nv-cap').textContent = cap == null ? '—' : Math.round(cap) % 360 + '°';
  $('nv-dist').textContent = prog == null ? '—' : RB.fmtDist(dist);
  $('nv-nextlabel').textContent = nx ? RB.label(nx) : '';
  const seg = nx && pv ? nx.s - pv.s : 0;
  $('nv-bar').firstElementChild.style.width = (seg > 0 ? Math.max(0, Math.min(100, (1 - dist / seg) * 100)) : 0).toFixed(0) + '%';
  // upozornění vibrací
  if(nx && prog != null && navigator.vibrate){
    if(dist <= WARN_M && !warned[nx.id]){ warned[nx.id] = 1; try{ navigator.vibrate([150, 80, 150]); }catch(e){} }
  }
}

// ---------------------------------------------------------------
// Start stránky
// ---------------------------------------------------------------
(async function boot(){
  try{ currentUser = await api('/api/auth/me'); }catch(e){ currentUser = null; }
  if(!currentUser){
    let hops = [];
    try{ hops = JSON.parse(sessionStorage.getItem('rbAuthHops') || '[]').filter(t => Date.now() - t < 20000); }catch(e){}
    if(hops.length >= 2){
      try{ sessionStorage.removeItem('rbAuthHops'); }catch(e){}
      document.body.classList.remove('auth-pending');
      $('nv-select').innerHTML = '<div class="wrap"><h1>Přihlášení se nepodařilo ověřit</h1><p class="sub"><a href="index.html">Přejít do Atlasu</a></p></div>';
      return;
    }
    hops.push(Date.now());
    try{ sessionStorage.setItem('rbAuthHops', JSON.stringify(hops)); }catch(e){}
    location.replace('index.html?next=' + encodeURIComponent('roadbook-navi.html' + location.search));
    return;
  }
  try{ sessionStorage.removeItem('rbAuthHops'); }catch(e){}
  document.body.classList.remove('auth-pending');
  if(window.CendurHeader) window.CendurHeader.setUser(currentUser);
  try{
    const [list, s] = await Promise.all([ api('/api/routes'), api('/api/roadbooks').catch(() => []) ]);
    routes = list; sums = {};
    (s || []).forEach(x => { sums[x.route_id] = x; });
  }catch(e){ $('nv-list').innerHTML = '<p class="sub">Trasy se nepodařilo načíst: ' + esc(e.message) + '</p>'; return; }
  renderSelect();
  const id = Number(new URLSearchParams(location.search).get('trasa'));
  if(id && routes.some(r => r.id === id)){
    // přímý odkaz z planneru: jízdu nespouštíme sami (GPS chce klepnutí), jen trasu zvýrazníme
    const b = $('nv-list').querySelector('.nv-route[data-id="' + id + '"]');
    if(b){ b.style.boxShadow = '0 0 0 4px #F5B700'; b.scrollIntoView({ block:'center' }); }
  }
})();

})();
