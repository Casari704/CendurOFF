// ===============================================================
// CendurOFF – jízda podle roadbooku přes celou obrazovku (v4.26)
//
// Dřív samostatná stránka Roadbook NAVI (roadbook-navi.html). Teď okno, které se otevře
// přímo v Atlasu (tlačítko 📒 Roadbook, nabídka u trasy) a v Roadbook editoru (simulace).
//
//  CendurRide.start({ route:{id,name,points}, items?, sim?, guest?, user?, loginHref?, onEnd? })
//     items  – instrukce předem (editor: rozpracovaný roadbook); jinak se stáhnou ze serveru,
//              bez signálu se vezmou z telefonu, a když trasa roadbook nemá, vygenerují se
//     sim    – simulace bez GPS (30 / 60 / 120 / 150 km/h, výchozí 60)
//     guest  – nepřihlášený: jen simulace a nahoře hláška s tlačítkem Přihlásit se (loginHref)
//  CendurRide.isOpen() · CendurRide.stop()
//  CendurRide.offline.{save(route), remove(id), has(id), info(id)} – roadbook do telefonu
//
// Poloha z GPS (public/gps.js) se promítá na trasu → počítadlo km, odpočet do další instrukce
// a posun krabiček (nové přijíždějí shora, aktuální je dole nad odpočtem).
// ===============================================================
(function(){
const RB = window.CendurRB;
const API_URL = window.CENDUROFF_API_URL || 'https://api.cenduroff.cz';
const $ = id => document.getElementById(id);
const esc = RB.esc;

const OFF_ROUTE_M = 50;        // dál od trasy = upozornění „mimo trasu“
const PASS_M = 8;              // instrukce je projetá, když jsme za ní o tolik metrů
const BACK_WINDOW = 200, FWD_WINDOW = 1500;   // kde hledat polohu na trase vůči minulé
const STEP_M = 50;             // korekce počítadla tlačítky ±
const MANUAL_MS = 4000;        // po ručním posunu roadbooku se za tolik ms vrátí k aktuální instrukci
const SIM_SPEEDS = [30, 60, 120, 150], SIM_DEFAULT = 60;

function toast(msg, ms){
  if(typeof window.toast === 'function') return window.toast(msg, ms);
  const t = $('toast'); if(!t) return; t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._h); toast._h = setTimeout(()=>{ t.style.display = 'none'; }, ms || 3200);
}
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
function unbusy(){ const b = $('rb-busy'); if(b) b.classList.remove('open'); }

// ---------------------------------------------------------------
// Okno jízdy (vloží se do stránky při prvním použití)
// ---------------------------------------------------------------
const HTML = `
<div id="nv-ride" aria-live="polite">
  <div id="nv-top">
    <div id="nv-odo">
      <div class="lb">KM CELKEM</div>
      <div id="nv-km">0,00</div>
      <div class="row2"><span>DÍLČÍ <strong id="nv-par">0,00</strong></span><span>CAP <strong id="nv-cap">—</strong></span></div>
    </div>
    <div id="nv-mini" role="img" aria-label="Minimapa: trasa a aktuální poloha"></div>
  </div>
  <div id="nv-rows"><div id="nv-rows-inner"></div></div>
  <div id="nv-next">
    <div class="a"><small>DALŠÍ ZA</small><div id="nv-dist">—</div></div>
    <div class="b"><div id="nv-nextlabel"></div><div id="nv-bar"><i></i></div></div>
  </div>
  <div id="nv-btns">
    <button type="button" id="nv-minus" aria-label="Odečíst 50 metrů z počítadla">−50 m</button>
    <button type="button" id="nv-plus" aria-label="Přičíst 50 metrů k počítadlu">+50 m</button>
    <button type="button" id="nv-mapbtn">Mapa</button>
    <button type="button" id="nv-end" class="go">Konec</button>
  </div>
  <div id="nv-alerts">
    <div id="nv-off"><svg id="nv-off-arrow" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 18-7-4-7 4z" fill="#fff"/></svg><span id="nv-off-text">MIMO TRASU</span></div>
  </div>
  <div id="nv-wait">Čekám na GPS signál…</div>
  <div id="nv-guest" hidden><b>Toto je jen simulace.</b><span>Pro jízdu podle roadbooku se přihlas.</span><button type="button" id="nv-guest-login">Přihlásit se</button></div>
  <div id="nv-sim"><button type="button" id="nv-sim-pause">⏸ Pauza</button><button type="button" id="nv-sim-speed">60 km/h</button></div>
  <div id="nv-bigmap"><div id="nv-bigmap-map"></div><button type="button" id="nv-bigmap-close">Zpět na roadbook</button></div>
</div>`;
let built = false, rbStatus = null;
function build(){
  if(built) return;
  built = true;
  document.body.insertAdjacentHTML('beforeend', HTML);
  if(!$('rb-busy')) document.body.insertAdjacentHTML('beforeend', '<div class="rb-busy" id="rb-busy"><div><div id="rb-busy-text">Pracuji…</div></div></div>');
  if(!$('toast')) document.body.insertAdjacentHTML('beforeend', '<div class="toast" id="toast"></div>');
  // všechny hlášky jízdy (GPS, ruční posun) ve společném sloupci (public/status.js) – vždy jen jedna:
  // MIMO TRASU > GPS > ruční posun
  rbStatus = window.CendurStatus.create($('nv-alerts'), { prepend:true, single:true, keepLast:true, className:'cs-rb', onChange: () => placeOff() });
  $('nv-end').addEventListener('click', () => { if(confirm(sim && !opts.guest ? 'Ukončit simulaci?' : 'Ukončit jízdu podle roadbooku?')) stop(); });
  $('nv-minus').addEventListener('click', () => { offset -= STEP_M; manualUntil = 0; render(false); });
  $('nv-plus').addEventListener('click', () => { offset += STEP_M; manualUntil = 0; render(false); });
  $('nv-guest-login').addEventListener('click', () => { if(opts.loginHref) location.href = opts.loginHref; });
  $('nv-sim-pause').addEventListener('click', () => { if(!sim) return; sim.paused = !sim.paused; $('nv-sim-pause').textContent = sim.paused ? '▶ Jet' : '⏸ Pauza'; });
  $('nv-sim-speed').addEventListener('click', () => {
    if(!sim) return;
    const i = SIM_SPEEDS.indexOf(sim.kmh);
    sim.kmh = SIM_SPEEDS[(i + 1) % SIM_SPEEDS.length];
    $('nv-sim-speed').textContent = sim.kmh + ' km/h';
  });
  $('nv-mapbtn').addEventListener('click', () => {
    $('nv-bigmap').classList.add('open');
    setTimeout(() => {
      big.invalidateSize();
      const p = bigMe ? bigMe.getLatLng() : null;
      if(p && prog != null) big.setView(p, 15); else big.fitBounds(L.polyline(R.lat.map((la, i) => [la, R.lon[i]])).getBounds(), { padding:[20, 20] });
    }, 50);
  });
  $('nv-bigmap-close').addEventListener('click', () => $('nv-bigmap').classList.remove('open'));
  $('nv-rows').addEventListener('scroll', placeOff, { passive: true });
  manualScroll();
  window.addEventListener('resize', () => {
    if(!isOpen()) return;
    setTimeout(placeOff, 120); setTimeout(placeGuest, 60);
    if(Date.now() > manualUntil) setTimeout(() => autoScroll(false), 100);
  });
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && isOpen()) requestWakeLock(); });
  // tlačítko Zpět v telefonu: zeptat se, jestli jízdu ukončit
  window.addEventListener('popstate', () => {
    if(!isOpen() || !histPushed) return;
    histPushed = false;
    if(confirm('Ukončit jízdu podle roadbooku?')) stop(true);
    else { try{ history.pushState({ cendurRide: 1 }, ''); histPushed = true; }catch(e){} }
  });
}
const isOpen = () => !!($('nv-ride') && $('nv-ride').classList.contains('open'));

// ---------------------------------------------------------------
// Offline: trasa a roadbook uložené v telefonu (v2.5)
// ---------------------------------------------------------------
const OFF_INDEX = 'offline:index';
const offKey = id => 'offline:route:' + id;
async function offlineIndex(){ return (await RB.store.get(OFF_INDEX)) || []; }
async function saveOffline(r, quiet){
  let rb = null;
  try{ rb = (await api('/api/roadbooks/' + r.id)).roadbook || null; }
  catch(e){ if(!quiet) toast('Roadbook se nepodařilo stáhnout: ' + e.message, 4500); return false; }
  const rec = { route: { id: r.id, name: r.name, distance_km: r.distance_km, points: r.points, owner_id: r.owner_id }, roadbook: rb, savedAt: Date.now() };
  await RB.store.set(offKey(r.id), rec);
  // v aplikaci CendurOFF: kopie i pro Android Auto (roadbook na displeji motorky)
  try{ if(window.CendurApp && window.CendurApp.storeRoadbook) window.CendurApp.storeRoadbook(r.id, JSON.stringify(rec)); }catch(e){}
  const idx = (await offlineIndex()).filter(x => x.id !== r.id);
  idx.push({ id: r.id, name: r.name, distance_km: r.distance_km, savedAt: rec.savedAt, status: rb ? rb.status : null });
  await RB.store.set(OFF_INDEX, idx);
  return true;
}
async function removeOffline(id){
  await RB.store.del(offKey(id));
  try{ if(window.CendurApp && window.CendurApp.removeRoadbook) window.CendurApp.removeRoadbook(id); }catch(e){}
  await RB.store.set(OFF_INDEX, (await offlineIndex()).filter(x => x.id !== id));
}
async function offlineInfo(id){ return (await offlineIndex()).find(x => x.id === id) || null; }

// ---------------------------------------------------------------
// Start a konec jízdy
// ---------------------------------------------------------------
let opts = {}, route = null, R = null, vis = [];
let prog = null;          // poloha na trase (m), null = zatím nevíme
let offset = 0;           // ruční korekce počítadla
let curIdx = -1;
let watchId = null, wakeLock = null, sim = null;
let mini = null, miniMe = null, big = null, bigMe = null, miniArrows = null, bigArrows = null;
let heading = null, speed = 0;
let soundGuide = null;    // zvuky a hlas v navigaci (public/sound.js)
let gpsBadge = null, posPredicted = false, progReal = null;
let histPushed = false;
function odo(){ return prog == null ? 0 : Math.max(0, Math.min(R.total, prog + offset)); }

async function start(o){
  build();
  if(isOpen()) stop(true);
  opts = Object.assign({}, o || {});
  const r = opts.route;
  if(!r || !Array.isArray(r.points) || r.points.length < 2){ toast('Trasa nemá body.'); return false; }
  if(opts.guest) opts.sim = true;
  route = r;
  let items = Array.isArray(opts.items) ? opts.items.map(x => Object.assign({ sides: [], icons: [] }, x)) : null;
  let reversed = !!opts.reversed;
  try{
    if(!items){
      busy('Načítám roadbook…');
      let res = null;
      try{ res = await api('/api/roadbooks/' + r.id); }
      catch(e){ if(!e.offline) throw e; res = null; }
      if(!res){
        // bez signálu: roadbook z telefonu
        const off = await RB.store.get(offKey(r.id));
        if(!off) throw new Error('jsi offline a tahle trasa není uložená v telefonu');
        res = { roadbook: off.roadbook };
        toast('Offline – jedeš podle roadbooku uloženého v telefonu.', 3500);
      } else if(await offlineInfo(r.id)){
        saveOffline(r, true);   // máme signál → offline kopii rovnou obnovíme
      }
      if(res.roadbook && res.roadbook.data && Array.isArray(res.roadbook.data.items)){
        reversed = !!(res.roadbook.data.settings && res.roadbook.data.settings.reversed);
        R = RB.prepareRoute(r.points, reversed);
        items = res.roadbook.data.items.map(x => Object.assign({ sides: [], icons: [] }, x));
        if(res.roadbook.stale){
          // trasa se změnila – instrukce jen posuneme na novou trasu, ať km sedí
          items = RB.reproject(R, items);
          toast('Pozor: trasa se od uložení roadbooku změnila, roadbook není zkontrolovaný.', 6000);
        } else if((res.roadbook.review_count || 0) > 0){
          toast('Roadbook je ke kontrole – některá místa čekají na kontrolu.', 4500);
        } else if(res.roadbook.status !== 'ready'){
          toast('Roadbook téhle trasy je zatím rozpracovaný.', 4500);
        }
      }
      if(!items){
        R = RB.prepareRoute(r.points, reversed);
        // bez stahování: použijí se jen OSM data, která už jsou v prohlížeči z Roadbook editoru
        const osm = await RB.store.get(RB.routeKey(r.id, r.points));
        const g = await RB.generate(r.points, { osm, reversed });
        items = g.items;
        toast(osm ? 'Roadbook vygenerován automaticky (nezkontrolovaný).' : 'Roadbook jen ze zatáček GPX (bez křižovatek) – úplný připrav v Roadbook editoru.', 5500);
      }
    } else {
      R = RB.prepareRoute(r.points, reversed);
    }
  }catch(e){
    unbusy(); toast('Roadbook se nepodařilo načíst: ' + e.message, 6000); return false;
  }
  unbusy();
  RB.recompute(R, items);
  vis = RB.visible(items);
  if(!vis.length){ toast('Roadbook nemá žádné instrukce.', 4000); return false; }
  prog = null; progReal = null; offset = 0; curIdx = -1; heading = null; speed = 0; manualUntil = 0;
  $('nv-ride').classList.add('open');
  $('nv-ride').dataset.routeId = r.id;
  document.body.classList.add('rb-ride-open');
  $('nv-guest').hidden = !opts.guest;
  try{ history.pushState({ cendurRide: 1 }, ''); histPushed = true; }catch(e){}
  // zvuky: odemknout (klepnutí na tlačítko) a nový hlídač instrukcí pro tuhle jízdu
  if(window.CendurSound){ CendurSound.unlock(); soundGuide = CendurSound.createGuide(); }
  setupMaps();
  buildCards();
  render(true);
  requestWakeLock();
  if(opts.sim) startSim(); else startGps();
  setTimeout(placeGuest, 60);
  return true;
}

function stop(fromHistory){
  soundGuide = null;
  if(watchId != null){ watchId.stop(); watchId = null; }
  if(gpsBadge) gpsBadge.hide();
  stopSim();
  if(wakeLock){ try{ wakeLock.release(); }catch(e){} wakeLock = null; }
  if(window.CendurApp && window.CendurApp.keepScreenOn){ try{ window.CendurApp.keepScreenOn(false); }catch(e){} }
  $('nv-ride').classList.remove('open');
  $('nv-bigmap').classList.remove('open');
  $('nv-guest').hidden = true;
  $('nv-off').classList.remove('open', 'keep');
  if(rbStatus){ rbStatus.clear('manual'); }
  document.body.classList.remove('rb-ride-open');
  if(histPushed && !fromHistory){ histPushed = false; try{ history.back(); }catch(e){} }
  histPushed = false;
  const cb = opts.onEnd; opts = {};
  if(cb) try{ cb(); }catch(e){ console.error(e); }
}

// hláška pro nepřihlášené: nahoře nad roadbookem (pod počítadlem), na výšku i na šířku
function placeGuest(){
  const g = $('nv-guest'); if(!g || g.hidden) return;
  const ride = $('nv-ride').getBoundingClientRect(), rows = $('nv-rows').getBoundingClientRect();
  g.style.top = Math.round(rows.top - ride.top + 8) + 'px';
  g.style.left = Math.round(rows.left - ride.left + rows.width / 2) + 'px';
  g.style.maxWidth = Math.round(rows.width - 16) + 'px';
}

async function requestWakeLock(){
  if(!('wakeLock' in navigator)) return;
  try{ wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
}

// ---------------------------------------------------------------
// GPS (public/gps.js – bez nepřesných poloh a skoků, při výpadku dopočet po trase)
// ---------------------------------------------------------------
function startGps(){
  if(!window.CendurGPS){ toast('Prohlížeč nepodporuje GPS.'); return; }
  $('nv-wait').classList.add('open');
  if(!gpsBadge) gpsBadge = window.CendurGPS.badge(rbStatus);
  watchId = window.CendurGPS.watch(pos => {
    $('nv-wait').classList.remove('open');
    const c = pos.coords;
    speed = (c.speed != null && !isNaN(c.speed)) ? c.speed : 0;
    heading = (speed > 1.5 && c.heading != null && !isNaN(c.heading)) ? c.heading : null;
    posPredicted = !!pos.predicted;
    onPosition(c.latitude, c.longitude);
    // počítání projetí tras a najetých km (jen skutečná jízda přihlášeného, ne simulace ani dopočet)
    if(!pos.predicted && window.CendurRides && opts.user) window.CendurRides.track(c.latitude, c.longitude, 'roadbook');
    if(opts.user && window.CendurRider) window.CendurRider.track(pos);
  }, err => {
    if(err && err.code === 1){ toast('Bez povolení polohy navigace nefunguje.', 5000); return; }
    $('nv-wait').classList.add('open');
  }, { predict:true, onStatus: st => { if(gpsBadge) gpsBadge.update(st); } });
  watchId.setPredictor((last, meters) => {
    const base = progReal != null ? progReal : prog;
    if(!R || base == null) return null;
    const sv = Math.min(R.total, base + meters);
    const q = RB.pointAt(R, sv);
    return { lat:q[0], lon:q[1], heading: RB.bearingBetween(R, sv, Math.min(R.total, sv + 30)) };
  });
}

function onPosition(lat, lon){
  // první poloha: místo na trase nejblíž ZAČÁTKU; když jsme od trasy daleko, začínáme na startu
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
  if(!off){ prog = p.s; if(!posPredicted) progReal = p.s; }
  if(off){
    const q = RB.pointAt(R, p.s);
    const b = RB.bearing([lat, lon], q);
    const hdg = heading != null ? heading : (RB.bearingBetween(R, prog, Math.min(R.total, prog + 30)) || 0);
    $('nv-off-arrow').style.transform = 'rotate(' + Math.round(RB.angleDiff(b, hdg)) + 'deg)';
    $('nv-off-text').textContent = 'MIMO TRASU · ' + RB.fmtDist(p.dist);
  }
  $('nv-off').classList.toggle('open', off);
  // na trase (do 25 m) se šipka přichytí na čáru
  if(!off && p.dist <= 25){ const q = RB.pointAt(R, p.s); updateMaps(q[0], q[1]); }
  else updateMaps(lat, lon);
  [miniMe, bigMe].forEach(m => { const el = m && m.getElement(); if(el) el.classList.toggle('gps-predicted', posPredicted); });
  render(false);
  placeOff();
  if(soundGuide) soundGuide.update(vis, odo(), speed, off);
}
// stavový pruh hlášek: přes celou šířku sloupce instrukcí, dole; vyjede, když je hláška
function placeOff(){
  const wrap = $('nv-alerts'), off = $('nv-off');
  if(!wrap || !rbStatus) return;
  const offOpen = off.classList.contains('open');
  const any = offOpen || rbStatus.count > 0;
  if(offOpen){ off.classList.add('keep'); rbStatus.el.style.display = 'none'; }
  else if(rbStatus.count > 0){ off.classList.remove('keep'); rbStatus.el.style.display = ''; }
  wrap.classList.toggle('open', any);
  const ride = $('nv-ride').getBoundingClientRect(), rows = $('nv-rows').getBoundingClientRect();
  wrap.style.width = Math.round(rows.width) + 'px';
  wrap.querySelectorAll('#nv-off, .cs-item').forEach(box => {
    let fs = 17; box.style.fontSize = fs + 'px';
    while(box.scrollWidth > box.clientWidth && fs > 12){ fs -= 1; box.style.fontSize = fs + 'px'; }
  });
  wrap.style.right = Math.round(ride.right - rows.right) + 'px';
  wrap.style.top = Math.round(rows.bottom - wrap.offsetHeight - ride.top) + 'px';
}

// ---------------------------------------------------------------
// Simulace (bez GPS)
// ---------------------------------------------------------------
function startSim(){
  sim = { s: 0, kmh: SIM_DEFAULT, paused: false, t: null };
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
function stopSim(){ if(sim && sim.t) clearInterval(sim.t); sim = null; const s = $('nv-sim'); if(s) s.classList.remove('open'); }

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
  if(miniArrows) miniArrows.remove();
  miniArrows = window.CendurArrows ? window.CendurArrows.attach(mini, ll, { spacing:120, size:16 }) : null;
  miniMe = L.marker(ll[0], { icon: meIcon(), keyboard:false, interactive:false }).addTo(mini);
  setTimeout(() => { mini.invalidateSize(); mini.setView(ll[0], 16); }, 60);
  if(!big){
    big = L.map('nv-bigmap-map', { zoomControl:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(big);
  }
  big.eachLayer(l => { if(l instanceof L.Polyline || l instanceof L.Marker) big.removeLayer(l); });
  L.polyline(ll, { color:'#4F7048', weight:6 }).addTo(big);
  if(bigArrows) bigArrows.remove();
  bigArrows = window.CendurArrows ? window.CendurArrows.attach(big, ll, { spacing:180, size:20 }) : null;
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

// ---------------------------------------------------------------
// Vykreslení roadbooku
// ---------------------------------------------------------------
function cardHTML(it){
  // dlouhá čísla (100 km a víc) menším písmem, ať nepřečnívají z buňky
  const km = RB.fmtKm(it.s), par = RB.fmtKm(it.par);
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
  setTimeout(placeOff, smooth ? 750 : 30);
}
// ruční posun prstem: na chvíli vypne automatické posouvání
function manualScroll(){
  const box = $('nv-rows');
  const touchNow = () => { manualUntil = Date.now() + MANUAL_MS; };
  ['touchstart', 'pointerdown', 'wheel'].forEach(ev => box.addEventListener(ev, touchNow, { passive: true }));
  box.addEventListener('scroll', () => { if(Date.now() > progScrollUntil) manualUntil = Date.now() + MANUAL_MS; }, { passive: true });
  setInterval(() => {
    if(!isOpen()) return;
    const left = manualUntil - Date.now();
    if(left > 0) rbStatus.set('manual', { title:'Ruční posun – zpět za ' + Math.ceil(left / 1000) + ' s', tone:'dark', prio:20 });
    else {
      rbStatus.clear('manual');
      if(manualUntil){ manualUntil = 0; autoScroll(true); }
    }
  }, 250);
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

window.CendurRide = {
  start, stop: () => { if(isOpen()) stop(); }, isOpen,
  offline: { save: saveOffline, remove: removeOffline, info: offlineInfo }
};
})();
