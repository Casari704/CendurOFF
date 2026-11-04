(function(){
// ===============================================================
// CendurOFF – Roadbook NAVI (roadbook-navi.html), v2.1
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
const BACK_WINDOW = 200, FWD_WINDOW = 1500;   // kde hledat polohu na trase vůči minulé
const STEP_M = 50;             // korekce počítadla tlačítky ±
const MANUAL_MS = 4000;        // po ručním posunu roadbooku se za tolik ms vrátí k aktuální instrukci

function toast(msg, ms){
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._h); toast._h = setTimeout(()=>{ t.style.display = 'none'; }, ms || 3200);
}
window.toast = window.toast || toast;
async function api(url, options){
  const o = Object.assign({ credentials:'include' }, options);
  let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
  if(t) o.headers = Object.assign({}, o.headers, { Authorization:'Bearer ' + t });
  let res;
  try{ res = await fetch(API_URL + url, o); }
  catch(err){ const e = new Error('Bez připojení k internetu.'); e.offline = true; throw e; }
  let data = null, isJson = false;
  try{ data = await res.json(); isJson = true; }catch(e){}
  if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
  if(!isJson) throw new Error('Server neodpověděl správně (zkus to prosím za chvíli).');
  return data;
}
function busy(text){ $('rb-busy-text').textContent = text || 'Pracuji…'; $('rb-busy').classList.add('open'); }
function unbusy(){ $('rb-busy').classList.remove('open'); }

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
      '<button type="button" class="nv-route" data-id="' + r.id + '"><b>' + esc(r.name) + (offlineIds.has(r.id) ? ' <span title="Uloženo v telefonu">📥</span>' : '') + '</b><span>' + (+r.distance_km).toFixed(1).replace('.', ',') + ' km</span><span class="rb-badge ' + g[2] + '">' + g[3] + '</span></button>').join('') + '</div>').join('') ||
    '<p class="sub">Žádná trasa.</p>';
  $('nv-list').querySelectorAll('.nv-route').forEach(b => b.addEventListener('click', () => pickRoute(Number(b.dataset.id), true)));
  if(picked) { const b = $('nv-list').querySelector('.nv-route[data-id="' + picked + '"]'); if(b) b.classList.add('on'); }
}
$('nv-search').addEventListener('input', renderSelect);

// --- offline: trasy a roadbooky uložené v telefonu (v2.5) ---
let offlineMode = false;            // bez signálu: pracuje se jen s uloženými trasami
let offlineIds = new Set();
const OFF_INDEX = 'offline:index';
const offKey = id => 'offline:route:' + id;
async function offlineIndex(){ return (await RB.store.get(OFF_INDEX)) || []; }
async function refreshOfflineIds(){ offlineIds = new Set((await offlineIndex()).map(x => x.id)); }
// uloží trasu + roadbook do telefonu (z API; když roadbook není, uloží jen trasu)
async function saveOffline(id, quiet){
  const r = routes.find(x => x.id === id);
  if(!r) return false;
  let rb = null;
  try{ rb = (await api('/api/roadbooks/' + id)).roadbook || null; }
  catch(e){ if(!quiet) toast('Roadbook se nepodařilo stáhnout: ' + e.message, 4500); return false; }
  const rec = { route: { id: r.id, name: r.name, distance_km: r.distance_km, points: r.points, owner_id: r.owner_id }, roadbook: rb, savedAt: Date.now() };
  await RB.store.set(offKey(id), rec);
  // v aplikaci CendurOFF: kopie i pro Android Auto (roadbook na displeji motorky)
  try{ if(window.CendurApp && window.CendurApp.storeRoadbook) window.CendurApp.storeRoadbook(id, JSON.stringify(rec)); }catch(e){}
  const idx = (await offlineIndex()).filter(x => x.id !== id);
  idx.push({ id: r.id, name: r.name, distance_km: r.distance_km, savedAt: rec.savedAt, status: rb ? rb.status : null });
  await RB.store.set(OFF_INDEX, idx);
  offlineIds.add(id);
  return true;
}
async function removeOffline(id){
  await RB.store.del(offKey(id));
  try{ if(window.CendurApp && window.CendurApp.removeRoadbook) window.CendurApp.removeRoadbook(id); }catch(e){}
  await RB.store.set(OFF_INDEX, (await offlineIndex()).filter(x => x.id !== id));
  offlineIds.delete(id);
}
async function renderOfflineBox(id){
  const box = $('nv-pick-off');
  if(!box) return;
  const idx = await offlineIndex();
  const it = idx.find(x => x.id === id);
  if(offlineMode){
    box.innerHTML = it ? '<span class="nv-off-ok">✓ Uloženo v telefonu (' + new Date(it.savedAt).toLocaleDateString('cs-CZ') + ')</span>' : '';
    return;
  }
  box.innerHTML = it
    ? '<span class="nv-off-ok">✓ Uloženo v telefonu pro offline (' + new Date(it.savedAt).toLocaleString('cs-CZ', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' }) + ')</span>' +
      '<button type="button" class="btn-rb" id="nv-off-upd">Aktualizovat</button><button type="button" class="btn-rb warn" id="nv-off-del">Odebrat z telefonu</button>'
    : '<button type="button" class="btn-rb" id="nv-off-save">📥 Uložit do telefonu pro offline</button><span class="note">Pak pojede i bez signálu (mapa jen tam, kde sis ji už prohlédl).</span>';
  const sv = $('nv-off-save'), up = $('nv-off-upd'), dl = $('nv-off-del');
  if(sv) sv.addEventListener('click', async () => { busy('Ukládám do telefonu…'); const ok = await saveOffline(id); unbusy(); if(ok){ toast('Trasa i roadbook jsou v telefonu – pojedou i bez signálu.'); renderOfflineBox(id); renderSelect(); } });
  if(up) up.addEventListener('click', async () => { busy('Aktualizuji…'); const ok = await saveOffline(id); unbusy(); if(ok){ toast('Offline kopie aktualizována.'); renderOfflineBox(id); } });
  if(dl) dl.addEventListener('click', async () => { await removeOffline(id); toast('Odebráno z telefonu.'); renderOfflineBox(id); renderSelect(); });
}

// --- mapa tras na výběrové obrazovce ---
let selMap = null, selLayer = null, picked = null;
function statusColor(id){ const sm = sums[id]; return sm ? (sm.status === 'ready' ? '#2E7D32' : '#E07B00') : '#5A5A5A'; }
function drawSelectMap(){
  if(!selMap){
    selMap = L.map('nv-map', { zoomControl:true }).setView([49.87, 17.87], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(selMap);
    selLayer = L.layerGroup().addTo(selMap);
  }
  selLayer.clearLayers();
  let bounds = null;
  routes.forEach(r => {
    if(!Array.isArray(r.points) || r.points.length < 2) return;
    const ll = r.points.filter((p, i) => i % 3 === 0 || i === r.points.length - 1).map(p => [p[0], p[1]]);
    const on = picked === r.id;
    const line = L.polyline(ll, { color: statusColor(r.id), weight: on ? 8 : 5, opacity: picked && !on ? 0.45 : 0.9 }).addTo(selLayer);
    const hit = L.polyline(ll, { color:'#000', weight: 20, opacity: 0, bubblingMouseEvents:false }).addTo(selLayer);
    hit.bindTooltip(esc(r.name), { sticky: true });
    hit.on('click', () => pickRoute(r.id, false));
    const b = line.getBounds(); bounds = bounds ? bounds.extend(b) : b;
  });
  if(bounds && !picked) selMap.fitBounds(bounds, { padding:[20, 20] });
  setTimeout(() => selMap.invalidateSize(), 60);
}
// vybraná trasa: karta s tlačítkem „Jet“ (GPS se zapne až klepnutím)
function pickRoute(id, fromList){
  const r = routes.find(x => x.id === id);
  if(!r) return;
  picked = id;
  const sm = sums[id];
  $('nv-pick-name').textContent = r.name;
  $('nv-pick-km').textContent = (+r.distance_km).toFixed(1).replace('.', ',') + ' km';
  const bd = $('nv-pick-badge');
  bd.className = 'rb-badge ' + (sm ? (sm.status === 'ready' ? 'ready' : 'draft') : 'none');
  bd.textContent = sm ? (sm.status === 'ready' ? 'READY' : 'NOT READY') : 'BEZ ROADBOOKU';
  $('nv-pick-note').textContent = sm
    ? (sm.status === 'ready' ? 'Roadbook je zkontrolovaný. Směr jízdy je daný roadbookem (obrací se v Roadbook planneru).' : 'Roadbook je rozpracovaný (NOT ready) – nemusí být úplný. Směr je daný roadbookem.')
    : 'Roadbook se vygeneruje jen ze zatáček GPX (bez křižovatek). Úplný roadbook připrav v Roadbook planneru.';
  $('nv-pick-rev-box').hidden = !!sm;
  $('nv-pick-rev').checked = false;
  $('nv-pick').classList.add('open');
  renderOfflineBox(id);
  drawSelectMap();
  renderSelect();
  if(fromList){
    const r0 = routes.find(x => x.id === id);
    if(r0) selMap.fitBounds(L.polyline(r0.points.map(p => [p[0], p[1]])).getBounds(), { padding:[20, 20] });
    $('nv-map').scrollIntoView({ block:'start', behavior:'smooth' });
  } else {
    $('nv-pick').scrollIntoView({ block:'nearest', behavior:'smooth' });
  }
}
$('nv-pick-go').addEventListener('click', () => { if(picked) startRide(picked, $('nv-pick-rev').checked); });

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

async function startRide(id, reverseNoRb){
  const r = routes.find(x => x.id === id);
  if(!r) return;
  route = r;
  let items = null, reversed = false;
  try{
    busy('Načítám roadbook…');
    let res;
    try{ res = offlineMode ? null : await api('/api/roadbooks/' + id); }
    catch(e){ if(!e.offline) throw e; res = null; }
    if(!res){
      // bez signálu: roadbook z telefonu
      const off = await RB.store.get(offKey(id));
      if(!off) throw new Error('jsi offline a tahle trasa není uložená v telefonu');
      res = { roadbook: off.roadbook };
      toast('Offline – jedeš podle roadbooku uloženého v telefonu.', 3500);
    } else if(offlineIds.has(id)){
      saveOffline(id, true);   // máme signál → offline kopii rovnou obnovíme
    }
    if(res.roadbook && res.roadbook.data && Array.isArray(res.roadbook.data.items)){
      reversed = !!(res.roadbook.data.settings && res.roadbook.data.settings.reversed);
      R = RB.prepareRoute(r.points, reversed);
      items = res.roadbook.data.items.map(x => Object.assign({ sides: [], icons: [] }, x));
      if(res.roadbook.stale){
        // trasa se změnila – instrukce jen posuneme na novou trasu, ať km sedí
        items = RB.reproject(R, items);
        toast('Pozor: trasa se od uložení roadbooku změnila, roadbook není zkontrolovaný.', 6000);
      } else if(res.roadbook.status !== 'ready'){
        toast('Roadbook téhle trasy ještě není označený jako hotový (NOT ready).', 4500);
      }
    }
    if(!items){
      reversed = !!reverseNoRb;
      R = RB.prepareRoute(r.points, reversed);
      // bez stahování: použijí se jen OSM data, která už jsou v prohlížeči z Roadbook planneru
      const osm = await RB.store.get(RB.routeKey(r.id, r.points));
      const g = await RB.generate(r.points, { osm, reversed });
      items = g.items;
      toast(osm ? 'Roadbook vygenerován automaticky (nezkontrolovaný).' : 'Roadbook jen ze zatáček GPX (bez křižovatek) – úplný připrav v Roadbook planneru.', 5500);
    }
  }catch(e){
    toast('Roadbook se nepodařilo načíst: ' + e.message, 6000); unbusy(); return;
  }finally{ unbusy(); }
  RB.recompute(R, items);
  vis = RB.visible(items);
  prog = null; offset = 0; curIdx = -1; warned = {}; heading = null; speed = 0; manualUntil = 0;
  $('nv-ride').classList.add('open');
  try{ history.replaceState(null, '', location.pathname + '?trasa=' + id); }catch(e){}
  setupMaps();
  buildCards();
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
$('nv-minus').addEventListener('click', () => { offset -= STEP_M; manualUntil = 0; render(false); });
$('nv-plus').addEventListener('click', () => { offset += STEP_M; manualUntil = 0; render(false); });

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
    // v2.5: počítání projetí tras (jen skutečná jízda, ne simulace)
    if(window.CendurRides && currentUser) window.CendurRides.track(c.latitude, c.longitude, 'roadbook');
  }, err => {
    if(err && err.code === 1){ toast('Bez povolení polohy NAVI nefunguje.', 5000); return; }
    $('nv-wait').classList.add('open');
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
}

function onPosition(lat, lon){
  // první poloha: místo na trase nejblíž ZAČÁTKU (u okruhu je start i cíl na stejném místě);
  // když jsme od trasy daleko, začínáme na startu
  if(prog == null){
    const p0 = RB.projectInitial(R, lat, lon);
    prog = p0.dist > 300 ? 0 : p0.s;
  }
  let p = RB.project(R, lat, lon, Math.max(0, prog - BACK_WINDOW), Math.min(R.total, prog + FWD_WINDOW));
  if(p.dist > 40){
    const g = RB.project(R, lat, lon);
    if(!p || g.dist + 15 < p.dist) p = g;
  }
  const off = p.dist > OFF_ROUTE_M;
  if(!off) prog = p.s;
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
function cardHTML(it){
  // dlouhá čísla (100 km a víc) menším písmem, ať nepřečnívají z buňky
  const km = RB.fmtKm(it.s), par = RB.fmtKm(it.par);
  // hodně symbolů → menší, ať se vejdou do buňky a nepřelézají do sousedních pokynů
  const all = it.icons || [], MAXIC = 9;
  const nIc = all.length + (it.danger ? 1 : 0);
  const icSize = nIc <= 3 ? 44 : nIc <= 4 ? 34 : 28;
  const icCls = nIc <= 3 ? '' : nIc <= 4 ? ' m' : ' s';
  const shown = all.slice(0, MAXIC - (it.danger ? 1 : 0));
  const icons = shown.map(k => RB.iconSVG(k, icSize)).join('') +
    (all.length > shown.length ? '<span class="more">+' + (all.length - shown.length) + '</span>' : '');
  return '<div class="nv-card next" data-i="' + (it.n - 1) + '">' +
    '<div class="nv-c1"><div class="n">#' + it.n + '</div><div class="t' + (km.length >= 6 ? ' long' : '') + '">' + km + '</div><div class="p' + (par.length >= 6 ? ' long' : '') + '">' + par + '</div></div>' +
    '<div class="nv-c2">' + RB.tulipSVG(it, 118) + '</div>' +
    '<div class="nv-c3' + icCls + '"><div class="ic">' + RB.dangerHTML(it.danger) + icons + '</div>' +
    '<div class="l">' + esc(RB.label(it)) + '</div><div class="s">' + esc(RB.subLabel(it)) + '</div>' +
    (it.kind === 'finish' ? '' : '<div class="cap">' + (it.cap || 0) + '°</div>') + '</div></div>';
}
// celý roadbook najednou: nahoře cíl, dole start; posouvá se buď sám (podle polohy), nebo prstem
let cards = [], manualUntil = 0, progScrollUntil = 0;
function buildCards(){
  let h = '';
  for(let i = vis.length - 1; i >= 0; i--) h += cardHTML(vis[i]);
  $('nv-rows-inner').innerHTML = h;
  cards = [];
  $('nv-rows-inner').querySelectorAll('.nv-card').forEach(el => { cards[Number(el.dataset.i)] = el; });
  const box = $('nv-rows');
  box.scrollTop = box.scrollHeight;
}
// cílová poloha posuvu: aktuální krabička dole, pod ní napůl vidět poslední projetá
function targetScroll(){
  const box = $('nv-rows'), el = cards[curIdx];
  if(!el) return box.scrollHeight;
  const peek = curIdx > 0 ? 70 : 0;
  return Math.max(0, Math.min(box.scrollHeight - box.clientHeight, el.offsetTop + el.offsetHeight + peek - box.clientHeight));
}
function autoScroll(smooth){
  const box = $('nv-rows'), t = targetScroll();
  if(Math.abs(box.scrollTop - t) < 2) return;
  progScrollUntil = Date.now() + (smooth ? 700 : 80);
  if(smooth && box.scrollTo) box.scrollTo({ top: t, behavior: 'smooth' }); else box.scrollTop = t;
}
// ruční posun prstem: na chvíli vypne automatické posouvání
(function manualScroll(){
  const box = $('nv-rows');
  const touchNow = () => { manualUntil = Date.now() + MANUAL_MS; };
  ['touchstart', 'pointerdown', 'wheel'].forEach(ev => box.addEventListener(ev, touchNow, { passive: true }));
  box.addEventListener('scroll', () => { if(Date.now() > progScrollUntil) manualUntil = Date.now() + MANUAL_MS; }, { passive: true });
  setInterval(() => {
    if(!$('nv-ride').classList.contains('open')) return;
    const left = manualUntil - Date.now();
    $('nv-manual').classList.toggle('open', left > 0);
    if(left > 0) $('nv-manual-s').textContent = Math.ceil(left / 1000);
    else if(manualUntil){ manualUntil = 0; autoScroll(true); }
  }, 250);
})();

function render(force){
  if(!R) return;
  const o = odo();
  // další instrukce = první, ke které jsme ještě nedojeli
  let idx = vis.findIndex(it => it.s > o + PASS_M);
  if(idx < 0) idx = vis.length - 1;
  if(prog == null) idx = Math.min(1, vis.length - 1);
  if(force || idx !== curIdx){
    curIdx = idx;
    cards.forEach((el, i) => { if(el) el.className = 'nv-card ' + (i < idx ? 'done' : i === idx ? 'cur' : 'next'); });
    if(Date.now() > manualUntil) autoScroll(!force);
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
}
window.addEventListener('resize', () => { if($('nv-ride').classList.contains('open') && Date.now() > manualUntil) setTimeout(() => autoScroll(false), 100); });

// ---------------------------------------------------------------
// Start stránky
// ---------------------------------------------------------------
(async function boot(){
  await refreshOfflineIds();
  try{ currentUser = await api('/api/auth/me'); try{ localStorage.setItem('cenduroff.rb.lastUser', JSON.stringify(currentUser)); }catch(e){} }
  catch(e){
    currentUser = null;
    // bez signálu: pokračuj s trasami uloženými v telefonu (přihlášení se ověří, až bude signál)
    if(e.offline && offlineIds.size){
      offlineMode = true;
      try{ currentUser = JSON.parse(localStorage.getItem('cenduroff.rb.lastUser') || 'null'); }catch(err){}
    } else if(e.offline){
      document.body.classList.remove('auth-pending');
      $('nv-select').innerHTML = '<div class="wrap"><h1>Jsi offline</h1><p class="sub">V telefonu zatím nemáš uloženou žádnou trasu. Až budeš mít signál, otevři trasu v Roadbook NAVI a dej „📥 Uložit do telefonu pro offline“ – pak pojede i bez dat.</p></div>';
      return;
    }
  }
  if(offlineMode){
    document.body.classList.remove('auth-pending');
    if(window.CendurHeader) window.CendurHeader.setUser(currentUser);
    const idx = await offlineIndex();
    routes = []; sums = {};
    for(const it of idx){
      const rec = await RB.store.get(offKey(it.id));
      if(!rec) continue;
      routes.push(rec.route);
      if(rec.roadbook) sums[it.id] = { route_id: it.id, status: rec.roadbook.status };
    }
    if(window.CendurRides) window.CendurRides.setRoutes(routes);
    $('nv-offline-note').hidden = false;
    renderSelect(); drawSelectMap();
    return;
  }
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
    if(window.CendurRides) window.CendurRides.setRoutes(routes);
    (s || []).forEach(x => { sums[x.route_id] = x; });
  }catch(e){ $('nv-list').innerHTML = '<p class="sub">Trasy se nepodařilo načíst: ' + esc(e.message) + '</p>'; return; }
  // offline kopie: smazané trasy odebrat, ostatní na pozadí obnovit (máme signál)
  (async () => {
    for(const it of await offlineIndex()){
      if(!routes.some(r => r.id === it.id)) await removeOffline(it.id);
      else await saveOffline(it.id, true);
    }
  })();
  renderSelect();
  drawSelectMap();
  // přímý odkaz z planneru: jízdu nespouštíme sami (GPS chce klepnutí), jen trasu vybereme
  const id = Number(new URLSearchParams(location.search).get('trasa'));
  if(id && routes.some(r => r.id === id)) pickRoute(id, true);
})();

})();
