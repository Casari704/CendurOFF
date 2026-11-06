(function(){
// ===============================================================
// CendurOFF – plánovač tras (planovac.html)
//
// Trasa = řada bodů (wps) a mezi každými dvěma sousedními body jeden úsek (segs).
// Úsek má režim:
//   'route'    – vedený po cestách plánovačem BRouter (brouter.de)
//   'straight' – přímá čára mezi body (nezávisle na mapě)
//   'raw'      – původní geometrie z nahrané/upravované GPX (zůstává beze změny,
//                dokud se nepohne s některým z jeho krajních bodů)
// ===============================================================

const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app'; // prázdná/chybějící adresa = Railway
const BROUTER_URL = 'https://brouter.de/brouter';
const DRAFT_KEY = 'cenduroff.planner.draft';
const IMPORT_KEY = 'cenduroff.planner.import';
const SETTINGS_KEY = 'cenduroff.planner.settings';
const PROFILE_CACHE_KEY = 'cenduroff.planner.brouterProfiles';
const MAX_EDIT_NODES = 400;   // kolik bodů nejvýš vytvoří import GPX (zbytek zůstane jako geometrie úseků)

const ROUTE_TYPES = {
  transport: { label:'Transportní', color:'#1E9A45' },
  cenduro:   { label:'Cenduro',     color:'#E9851C' },
  offroad:   { label:'Offroad',     color:'#E0241B' }
};
const COLORS = { route:'#1E64D6', straight:'#E9851C', raw:'#6A3FB5', error:'#D32F2F', loading:'#7A8A7A' };

// ---------------------------------------------------------------
// Pomocné funkce
// ---------------------------------------------------------------
function toast(msg, ms){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>{ t.style.display='none'; }, ms || 3200);
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function haversine(a,b){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b[0]-a[0]), dLon=toRad(b[1]-a[1]);
  const s=Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function computeStats(points){
  let dist=0, gain=0;
  for(let i=1;i<points.length;i++){
    dist += haversine(points[i-1], points[i]);
    const d = (points[i][2]||0) - (points[i-1][2]||0);
    if(points[i][2]!=null && points[i-1][2]!=null && d>0) gain += d;
  }
  return { distanceKm: dist/1000, elevGainM: gain };
}
async function api(url, options){
  const o = Object.assign({ credentials:'include' }, options);
  let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
  if(t) o.headers = Object.assign({}, o.headers, { Authorization: 'Bearer ' + t });
  const res = await fetch(API_URL + url, o);
  let data = null, isJson = false;
  try{ data = await res.json(); isJson = true; }catch(e){}
  if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
  if(!isJson) throw new Error('Server neodpověděl správně (zkus to prosím za chvíli).');
  return data;
}
function parseGPX(text){
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('Soubor se nepodařilo přečíst jako GPX.');
  let pts = Array.from(doc.getElementsByTagName('trkpt'));
  if(pts.length===0) pts = Array.from(doc.getElementsByTagName('rtept'));
  if(pts.length===0) throw new Error('V souboru nebyly nalezeny žádné body trasy.');
  const points = pts.map(p=>{
    const lat = parseFloat(p.getAttribute('lat'));
    const lon = parseFloat(p.getAttribute('lon'));
    const eleEl = p.getElementsByTagName('ele')[0];
    const ele = eleEl ? parseFloat(eleEl.textContent) : null;
    return [lat, lon, (ele==null || isNaN(ele)) ? null : ele];
  }).filter(p=>!isNaN(p[0]) && !isNaN(p[1]));
  const nameEl = doc.getElementsByTagName('name')[0];
  return { points, suggestedName: nameEl ? nameEl.textContent.trim() : '' };
}
function pointsToGPX(points, name){
  const trkpts = points.map(p=>{
    const eleTag = (p[2]!=null && !isNaN(p[2])) ? `<ele>${Math.round(p[2]*10)/10}</ele>` : '';
    return `<trkpt lat="${p[0]}" lon="${p[1]}">${eleTag}</trkpt>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n`+
    `<gpx version="1.1" creator="CendurOFF planovac" xmlns="http://www.topografix.com/GPX/1/1">\n`+
    `<trk><name>${escapeHtml(name||'trasa')}</name><trkseg>${trkpts}</trkseg></trk>\n</gpx>`;
}
function downloadGPX(points, name){
  const blob = new Blob([pointsToGPX(points, name)], { type:'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (name || 'trasa').trim().replace(/[^a-z0-9_\-]+/gi,'_') + '.gpx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function lsGet(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
function lsSet(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(e){ return false; } }

// Douglas–Peucker zjednodušení (vrací indexy bodů, které se zachovají) – v metrech, lokální projekce
function simplifyIndices(points, tolM){
  if(points.length <= 2) return points.map((_,i)=>i);
  const lat0 = points[0][0] * Math.PI/180;
  const kx = 111320 * Math.cos(lat0), ky = 110540;
  const xy = points.map(p=>[p[1]*kx, p[0]*ky]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length-1] = 1;
  const stack = [[0, points.length-1]];
  while(stack.length){
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx-ax, dy = by-ay, len2 = dx*dx + dy*dy;
    for(let i=a+1;i<b;i++){
      const [px, py] = xy[i];
      let t = len2 ? ((px-ax)*dx + (py-ay)*dy)/len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t*dx - px, ey = ay + t*dy - py;
      const d = ex*ex + ey*ey;
      if(d > maxD){ maxD = d; idx = i; }
    }
    if(idx >= 0 && maxD > tolM*tolM){
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = [];
  for(let i=0;i<points.length;i++) if(keep[i]) out.push(i);
  return out;
}

// nejbližší místo na lomené čáře k bodu ll -> { k (index úseku), lat, lng, ele }
function nearestOnLine(pts, ll){
  const lat0 = ll.lat * Math.PI/180;
  const kx = 111320 * Math.cos(lat0), ky = 110540;
  const px = ll.lng*kx, py = ll.lat*ky;
  let best = null;
  for(let k=0;k<pts.length-1;k++){
    const ax = pts[k][1]*kx, ay = pts[k][0]*ky, bx = pts[k+1][1]*kx, by = pts[k+1][0]*ky;
    const dx = bx-ax, dy = by-ay, len2 = dx*dx+dy*dy;
    let t = len2 ? ((px-ax)*dx + (py-ay)*dy)/len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const ex = ax+t*dx-px, ey = ay+t*dy-py, d = ex*ex+ey*ey;
    if(!best || d < best.d){
      const ea = pts[k][2], eb = pts[k+1][2];
      best = { d, k, t,
        lat: pts[k][0] + t*(pts[k+1][0]-pts[k][0]),
        lng: pts[k][1] + t*(pts[k+1][1]-pts[k][1]),
        ele: (ea!=null && eb!=null) ? ea + t*(eb-ea) : (ea!=null ? ea : eb) };
    }
  }
  return best;
}

// ---------------------------------------------------------------
// Stav plánovače
// ---------------------------------------------------------------
let wps = [];        // [{ lat, lng, ele, small }]
let segs = [];       // [{ mode, pts:[[lat,lng,ele]] | null, error, loading, req }]
let editing = null;  // upravovaná trasa z CendurOFF: { id, name, description, route_type, owner_id }
let currentUser = null;
function isAdminUser(){ return !!(currentUser && currentUser.role === 'admin'); }
// upravovat (otevřít v plánovači a přepsat) smí jen vlastník trasy nebo admin
function canEditRoute(ownerId){ return !!currentUser && (Number(ownerId) === Number(currentUser.id) || isAdminUser()); }
const settings = Object.assign({ drawMode:'route', pref:'teren', allowPaths:true, showRoutes:true }, lsGet(SETTINGS_KEY, {}));
function saveSettings(){ lsSet(SETTINGS_KEY, settings); }

const undoStack = [], redoStack = [];
function snapshot(){
  return {
    wps: wps.map(w=>Object.assign({}, w)),
    // pts se nikdy nemění "na místě" (vždy nové pole), proto stačí mělká kopie
    segs: segs.map(s=>({ mode:s.mode, pts:s.pts, error:!!s.error, needsRoute: s.mode==='route' && (s.loading || !s.pts) })),
    editing: editing ? Object.assign({}, editing) : null
  };
}
function pushUndo(){
  undoStack.push(snapshot());
  if(undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}
function restore(snap){
  wps = snap.wps.map(w=>Object.assign({}, w));
  // staré výpočty zahodit a obnovit úseky jako nové objekty (s počítadlem požadavků)
  segs.forEach(s=>{ s.req = (s.req||0) + 1; });
  segs = snap.segs.map(s=>{ const n = newSeg(s.mode, s.needsRoute ? null : s.pts); n.error = s.error; return n; });
  editing = snap.editing ? Object.assign({}, snap.editing) : null;
  segs.forEach(s=>{ if(s.mode==='route' && (!s.pts || s.needsRoute)) requestRoute(s); });
  changed();
}
function undo(){
  if(!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateUndoButtons();
}
function redo(){
  if(!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateUndoButtons();
}
function updateUndoButtons(){
  ['pl-undo','pl-undo-qb'].forEach(id=>{ const b = document.getElementById(id); if(b) b.disabled = !undoStack.length; });
  const r = document.getElementById('pl-redo'); if(r) r.disabled = !redoStack.length;
}

function newSeg(mode, pts){ return { mode, pts: pts || null, error:false, loading:false, req:0 }; }

// geometrie úseku pro vykreslení / export
function segGeometry(i){
  const s = segs[i], a = wps[i], b = wps[i+1];
  if(s.mode==='straight' || !s.pts || !s.pts.length) return [[a.lat,a.lng,a.ele!=null?a.ele:null],[b.lat,b.lng,b.ele!=null?b.ele:null]];
  return s.pts;
}

// celá trasa jako jedno pole bodů [lat, lon, ele]
function assemble(){
  if(wps.length===0) return [];
  if(wps.length===1) return [[wps[0].lat, wps[0].lng, wps[0].ele!=null ? wps[0].ele : null]];
  const out = [];
  for(let i=0;i<segs.length;i++){
    const g = segGeometry(i);
    for(const p of g){
      const q = [Math.round(p[0]*1e6)/1e6, Math.round(p[1]*1e6)/1e6, p[2]!=null && !isNaN(p[2]) ? Math.round(p[2]*10)/10 : null];
      const last = out[out.length-1];
      if(last && haversine(last, q) < 0.5){ if(last[2]==null) last[2] = q[2]; continue; }
      out.push(q);
    }
  }
  // chybějící výšky (rovné úseky) dopočítáme lineárně ze sousedních známých bodů
  const known = [];
  out.forEach((p,i)=>{ if(p[2]!=null) known.push(i); });
  if(known.length){
    for(let i=0;i<out.length;i++){
      if(out[i][2]!=null) continue;
      let lo = -1, hi = -1;
      for(let k=0;k<known.length;k++){ if(known[k] < i) lo = known[k]; else { hi = known[k]; break; } }
      if(lo>=0 && hi>=0){
        const t = (i-lo)/(hi-lo);
        out[i][2] = Math.round((out[lo][2] + t*(out[hi][2]-out[lo][2]))*10)/10;
      } else out[i][2] = out[lo>=0 ? lo : hi][2];
    }
  }
  return out;
}

// ---------------------------------------------------------------
// BRouter – nahrání vlastního profilu a hledání cesty
// ---------------------------------------------------------------
let profileCache = Object.assign({}, (()=>{ try{ return JSON.parse(sessionStorage.getItem(PROFILE_CACHE_KEY) || '{}'); }catch(e){ return {}; } })());
const profilePromises = {};
function profileKey(){ return settings.pref + (settings.allowPaths ? '_p' : '_np'); }
async function getProfileId(forceNew){
  const key = profileKey();
  if(!forceNew && profileCache[key]) return profileCache[key];
  if(!forceNew && profilePromises[key]) return profilePromises[key];
  const text = window.CendurBRouterProfile(settings.pref, settings.allowPaths);
  profilePromises[key] = (async ()=>{
    // text/plain = "jednoduchý" požadavek, prohlížeč nemusí posílat CORS preflight
    const res = await fetch(BROUTER_URL + '/profile', { method:'POST', headers:{ 'Content-Type':'text/plain' }, body:text });
    const data = await res.json();
    if(data.error) throw new Error('Profil plánovače: ' + data.error);
    if(!data.profileid) throw new Error('Plánovač nevrátil profil.');
    profileCache[key] = data.profileid;
    try{ sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileCache)); }catch(e){}
    return data.profileid;
  })();
  try{ return await profilePromises[key]; }
  finally{ delete profilePromises[key]; }
}

// fronta požadavků - nejvýš 3 současně, ať brouter.de nezahltíme
let running = 0;
const queue = [];
function pump(){
  while(running < 3 && queue.length){
    const job = queue.shift();
    running++;
    job().finally(()=>{ running--; updateBusy(); pump(); });
  }
  updateBusy();
}
function updateBusy(){
  const busy = running + queue.length > 0;
  document.getElementById('pl-busy').hidden = !busy;
}

async function fetchRoute(a, b, retried){
  const profile = await getProfileId(!!retried);
  const url = `${BROUTER_URL}?lonlats=${a.lng.toFixed(6)},${a.lat.toFixed(6)}|${b.lng.toFixed(6)},${b.lat.toFixed(6)}` +
              `&profile=${encodeURIComponent(profile)}&alternativeidx=0&format=geojson`;
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 25000);
  let res, text;
  try{
    res = await fetch(url, { signal:ctrl.signal });
    text = await res.text();
  }catch(e){
    throw new Error(e && e.name === 'AbortError' ? 'timeout' : (e.message || String(e)));
  }finally{ clearTimeout(timer); }
  if(!res.ok){
    // vlastní profily server po čase maže - zkusíme ho jednou nahrát znovu
    if(!retried && /profile/i.test(text)) return fetchRoute(a, b, true);
    throw new Error(text.trim() || ('HTTP ' + res.status));
  }
  const data = JSON.parse(text);
  const coords = data && data.features && data.features[0] && data.features[0].geometry && data.features[0].geometry.coordinates;
  if(!coords || coords.length < 2) throw new Error('prázdná trasa');
  return coords.map(c=>[c[1], c[0], c.length > 2 && c[2]!=null ? Number(c[2]) : null]);
}

function brouterErrorText(msg){
  if(/not mapped|position not/i.test(msg)) return 'bod je moc daleko od cest v mapě';
  if(/island/i.test(msg)) return 'místo není propojené se zbytkem cest';
  if(/watchdog|timeout|killed/i.test(msg)) return 'hledání trvalo moc dlouho';
  if(/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'plánovač není dostupný (signál?)';
  return msg.length > 80 ? msg.slice(0,80) + '…' : msg;
}

let errorToastShown = 0;
function requestRoute(seg){
  if(!Number.isFinite(seg.req)) seg.req = 0;
  seg.loading = true;
  seg.error = false;
  const myReq = ++seg.req;
  queue.push(async ()=>{
    const i = segs.indexOf(seg);
    if(i < 0 || seg.req !== myReq || seg.mode !== 'route'){
      // výpočet je zastaralý; pokud na úsek nečeká jiný požadavek, nesmí zůstat "rozpočítaný"
      if(seg.req === myReq){ seg.loading = false; changed(true); }
      return;
    }
    const a = { lat:wps[i].lat, lng:wps[i].lng }, b = { lat:wps[i+1].lat, lng:wps[i+1].lng };
    try{
      const pts = await fetchRoute(a, b);
      if(seg.req !== myReq || segs.indexOf(seg) < 0) return;
      seg.pts = pts;
      seg.error = false;
    }catch(e){
      if(seg.req !== myReq || segs.indexOf(seg) < 0) return;
      seg.pts = null;
      seg.error = true;
      if(Date.now() - errorToastShown > 4000){
        errorToastShown = Date.now();
        toast('Úsek se nepodařilo najít po cestách (' + brouterErrorText(String(e.message||e)) + '). Je nakreslený rovně červeně – přepni ho na „Rovně“, nebo posuň bod.', 6000);
      }
    }
    seg.loading = false;
    changed(true);
  });
  pump();
}

// ---------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------
const map = L.map('map', { zoomControl:false }).setView([49.8711, 17.8756], 12);
const baseLayers = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }),
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom:19, maxNativeZoom:17, attribution:'© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)' }),
  // v ČR letecké snímky ČÚZK, pod nimi Esri (vidět za hranicemi)
  sat: L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, maxNativeZoom:20, attribution:'Ortofoto © ČÚZK' })
  ])
};
// stejné názvy a pořadí jako v Atlasu
const baseNames = {
  topo:'Turistická (OpenTopoMap) – výrazné vrstevnice',
  osm:'Základní (OpenStreetMap) – bez vrstevnic',
  sat:'Satelit (ČÚZK v ČR, Esri mimo ČR)'
};
const baseShort = { topo:'Turistická', osm:'Základní', sat:'Satelit' };
const BASE_ORDER = ['osm','topo','sat'];
// podkladová mapa je společná s Atlasem (stejný klíč v prohlížeči) - změna na jedné stránce platí i na druhé
const SHARED_BASE_KEY = 'baseMap';
let currentBase = (()=>{ try{ return localStorage.getItem(SHARED_BASE_KEY); }catch(e){ return null; } })();
if(!baseLayers[currentBase]) currentBase = 'osm';
baseLayers[currentBase].addTo(map);

// tlačítka mapy jako v Atlasu: 🗺 (nabídka podkladů), +, −
document.getElementById('pl-zoom-in').addEventListener('click', ()=> map.zoomIn());
document.getElementById('pl-zoom-out').addEventListener('click', ()=> map.zoomOut());
const layersBtn = document.getElementById('pl-layers-btn');
layersBtn.title = 'Podkladová mapa, benzínky, CHKO';
document.body.insertAdjacentHTML('beforeend', `<div id="layer-menu" role="menu">
  <div class="layer-menu-title">Podkladová mapa</div>
  ${BASE_ORDER.map(k=>`<button type="button" class="layer-opt" data-base="${k}" role="menuitemradio"><span class="layer-radio"></span>${baseNames[k]}</button>`).join('')}
</div>`);
const layerMenu = document.getElementById('layer-menu');
function syncLayerMenu(){
  layerMenu.querySelectorAll('.layer-opt[data-base]').forEach(b=>{
    const on = b.dataset.base === currentBase;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
}
function setBaseMap(k){
  if(!baseLayers[k] || k===currentBase) return;
  map.removeLayer(baseLayers[currentBase]);
  currentBase = k;
  baseLayers[k].addTo(map);
  try{ localStorage.setItem(SHARED_BASE_KEY, k); }catch(e){}
  syncLayerMenu();
}
function placeLayerMenu(){
  const r = layersBtn.getBoundingClientRect();
  layerMenu.style.left = 'auto';
  layerMenu.style.top = Math.round(r.top) + 'px';
  layerMenu.style.right = Math.max(8, Math.round(window.innerWidth - r.left + 8)) + 'px';
  layerMenu.style.maxHeight = Math.max(160, window.innerHeight - r.top - 8) + 'px';
  layerMenu.style.overflowY = 'auto';
}
layersBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  placeLayerMenu();
  layerMenu.classList.toggle('open');
});
layerMenu.addEventListener('click', (e)=>{
  const b = e.target.closest('.layer-opt');
  if(!b) return;
  setBaseMap(b.dataset.base);
  layerMenu.classList.remove('open');
  toast('Mapa: ' + baseShort[b.dataset.base], 1800);
});
document.addEventListener('click', (e)=>{
  if(layerMenu.classList.contains('open') && !layerMenu.contains(e.target) && e.target !== layersBtn) layerMenu.classList.remove('open');
});
window.addEventListener('resize', ()=>{ if(layerMenu.classList.contains('open')) placeLayerMenu(); });
syncLayerMenu();
if(window.CendurFuel) CendurFuel.attach(map, layerMenu);
if(window.CendurChko) CendurChko.attach(map, layerMenu);

map.createPane('pl-others').style.zIndex = 405;
map.createPane('pl-route').style.zIndex = 450;
const othersLayer = L.layerGroup().addTo(map);
const segLayer = L.layerGroup().addTo(map);
const wpLayer = L.layerGroup().addTo(map);

let popupOpen = false, lastPopupClose = 0;
map.on('popupopen', ()=>{ popupOpen = true; });
map.on('popupclose', ()=>{ popupOpen = false; lastPopupClose = Date.now(); });

map.on('click', e=>{
  if(popupOpen || Date.now() - lastPopupClose < 350) return;
  addPoint(e.latlng);
});

// ---------------------------------------------------------------
// Úpravy trasy
// ---------------------------------------------------------------
function addPoint(ll){
  pushUndo();
  wps.push({ lat:ll.lat, lng:ll.lng, ele:null, small:false });
  if(wps.length > 1){
    const s = newSeg(settings.drawMode);
    segs.push(s);
    if(s.mode==='route') requestRoute(s);
  }
  changed();
}

// po posunutí/smazání bodu: sousední úseky se přepočítají (původní GPX úsek se převede
// na aktuální režim kreslení, protože jeho geometrie už k bodům nesedí)
function touchSeg(s){
  if(s.mode==='raw') s.mode = settings.drawMode;
  if(s.mode==='route'){ s.pts = null; requestRoute(s); }
  else { s.pts = null; s.error = false; s.loading = false; s.req++; }
}

function moveWaypoint(i, ll){
  pushUndo();
  wps[i] = Object.assign({}, wps[i], { lat:ll.lat, lng:ll.lng, ele:null, small:false });
  if(i > 0) touchSeg(segs[i-1]);
  if(i < segs.length) touchSeg(segs[i]);
  changed();
}

function deleteWaypoint(i){
  pushUndo();
  if(wps.length <= 1){ wps = []; segs = []; changed(); return; }
  if(i === 0){ wps.shift(); segs.shift(); }
  else if(i === wps.length-1){ wps.pop(); segs.pop(); }
  else {
    const s1 = segs[i-1], s2 = segs[i];
    let merged;
    if(s1.mode==='raw' && s2.mode==='raw' && s1.pts && s2.pts){
      merged = newSeg('raw', s1.pts.concat(s2.pts.slice(1)));
    } else if(s1.mode==='straight' && s2.mode==='straight'){
      merged = newSeg('straight');
    } else {
      const mode = (s1.mode==='route' || s2.mode==='route' || settings.drawMode==='route') ? 'route' : 'straight';
      merged = newSeg(mode);
    }
    wps.splice(i, 1);
    segs.splice(i-1, 2, merged);
    if(merged.mode==='route') requestRoute(merged);
  }
  changed();
}

function insertOnSeg(i, ll){
  const g = segGeometry(i);
  const n = nearestOnLine(g, ll);
  if(!n) return;
  pushUndo();
  const s = segs[i];
  const p = [n.lat, n.lng, n.ele];
  const pts1 = g.slice(0, n.k+1).concat([p]);
  const pts2 = [p].concat(g.slice(n.k+1));
  const s1 = newSeg(s.mode, s.mode==='straight' ? null : pts1);
  const s2 = newSeg(s.mode, s.mode==='straight' ? null : pts2);
  s1.error = s2.error = s.error;
  s.req++; // případný běžící výpočet starého úseku zahodit
  wps.splice(i+1, 0, { lat:n.lat, lng:n.lng, ele:n.ele, small:false });
  segs.splice(i, 1, s1, s2);
  // úsek, který se ještě počítal (nebo selhal), přepočítáme po částech
  if(s.mode==='route' && (s.loading || s.error || !s.pts)){ s1.pts = s2.pts = null; requestRoute(s1); requestRoute(s2); }
  changed();
}

// v3.3: rozdělení trasy v bodě – smaže všechno před bodem (nový start) nebo za bodem (nový cíl)
function trimRoute(i, part){
  if(i <= 0 || i >= wps.length-1) return;
  pushUndo();
  if(part === 'start'){
    segs.slice(0, i).forEach(s=>s.req++);
    wps = wps.slice(i); segs = segs.slice(i);
    toast('Začátek trasy smazán – tady je teď start. (Vrátíš tlačítkem Zpět.)');
  } else {
    segs.slice(i).forEach(s=>s.req++);
    wps = wps.slice(0, i+1); segs = segs.slice(0, i);
    toast('Konec trasy smazán – tady je teď cíl. (Vrátíš tlačítkem Zpět.)');
  }
  changed();
}

function setSegMode(i, mode){
  if(!segs[i] || segs[i].mode === mode) return;
  pushUndo();
  const s = segs[i];
  s.mode = mode;
  s.req++;
  s.loading = false;
  s.error = false;
  s.pts = null;
  if(mode==='route') requestRoute(s);
  changed();
}

function reverseRoute(){
  if(wps.length < 2) return;
  pushUndo();
  wps = wps.slice().reverse();
  segs = segs.slice().reverse().map(s=>{
    const r = newSeg(s.mode, s.pts ? s.pts.slice().reverse() : null);
    r.error = s.error;
    if(s.loading){ s.req++; }
    return r;
  });
  segs.forEach(s=>{ if(s.mode==='route' && !s.pts) requestRoute(s); });
  changed();
  toast('Směr trasy otočen.');
}

function clearAll(){
  if(!wps.length && !editing) return;
  if(!confirm('Vymazat celou trasu z plánovače? (Krok jde vrátit tlačítkem Zpět.)')) return;
  pushUndo();
  segs.forEach(s=>s.req++);
  wps = []; segs = []; editing = null;
  changed();
}

function rerouteAll(){
  const routeSegs = segs.filter(s=>s.mode==='route');
  if(!routeSegs.length) return;
  pushUndo();
  routeSegs.forEach(s=>{ s.pts = null; requestRoute(s); });
  changed();
}

// načtení hotové trasy (z CendurOFF / GPX / záznamu jízdy) jako upravitelných bodů
function loadPoints(points, meta){
  points = points.filter(p=>Number.isFinite(p[0]) && Number.isFinite(p[1]))
                 .map(p=>[p[0], p[1], p[2]==null || isNaN(p[2]) ? null : Number(p[2])]);
  if(points.length < 2) throw new Error('Trasa nemá dost bodů.');
  pushUndo();
  segs.forEach(s=>s.req++);
  // zjednodušení na rozumný počet bodů k tažení; mezi nimi zůstává původní geometrie
  let tol = 12, idx = simplifyIndices(points, tol);
  while(idx.length > MAX_EDIT_NODES && tol < 2000){ tol *= 1.6; idx = simplifyIndices(points, tol); }
  wps = idx.map((k,j)=>({ lat:points[k][0], lng:points[k][1], ele:points[k][2], small: j>0 && j<idx.length-1 }));
  segs = [];
  for(let j=0;j<idx.length-1;j++) segs.push(newSeg('raw', points.slice(idx[j], idx[j+1]+1)));
  editing = meta || null;
  changed();
  fitToRoute();
}

function fitToRoute(){
  const pts = assemble();
  if(pts.length >= 2) map.fitBounds(L.latLngBounds(pts.map(p=>[p[0],p[1]])), { padding:[40,40], maxZoom:16 });
  else if(pts.length===1) map.setView([pts[0][0], pts[0][1]], 15);
}

// ---------------------------------------------------------------
// Vykreslení
// ---------------------------------------------------------------
function wpIcon(i){
  const n = wps.length;
  let cls = 'pl-wp';
  if(i===0) cls += ' pl-wp-start';
  else if(i===n-1) cls += ' pl-wp-end';
  else if(wps[i].small) cls += ' pl-wp-small';
  const size = (i===0 || i===n-1) ? 22 : (wps[i].small ? 12 : 16);
  return L.divIcon({ className:cls, html:'', iconSize:[size,size], iconAnchor:[size/2,size/2] });
}

function segStyle(s){
  if(s.mode==='route' && (s.loading || !s.pts) && !s.error) return { color:COLORS.loading, weight:5, opacity:0.9, dashArray:'4 8' };
  if(s.mode==='route' && s.error) return { color:COLORS.error, weight:5, opacity:1, dashArray:'8 6' };
  if(s.mode==='straight') return { color:COLORS.straight, weight:6, opacity:1, dashArray:'10 7' };
  if(s.mode==='raw') return { color:COLORS.raw, weight:6, opacity:1 };
  return { color:COLORS.route, weight:6, opacity:1 };
}

let segLines = [];
function renderSegs(){
  segLayer.clearLayers();
  segLines = [];
  segs.forEach((s,i)=>{
    const latlngs = segGeometry(i).map(p=>[p[0],p[1]]);
    const line = L.polyline(latlngs, Object.assign({ pane:'pl-route', interactive:false }, segStyle(s))).addTo(segLayer);
    // široká neviditelná čára = pohodlnější trefa prstem
    const hit = L.polyline(latlngs, { pane:'pl-route', weight:22, opacity:0, bubblingMouseEvents:false }).addTo(segLayer);
    hit.on('click', e=>{
      L.DomEvent.stopPropagation(e);
      const idx = segLines.findIndex(x=>x.hit===hit);
      if(idx >= 0) insertOnSeg(idx, e.latlng);
    });
    hit.on('mouseover', ()=> line.setStyle({ weight:9 }));
    hit.on('mouseout', ()=> line.setStyle({ weight:segStyle(s).weight }));
    segLines.push({ line, hit });
  });
}

function renderWps(){
  wpLayer.clearLayers();
  wps.forEach((w,i)=>{
    const m = L.marker([w.lat, w.lng], { icon:wpIcon(i), draggable:true, autoPan:true, zIndexOffset: (i===0||i===wps.length-1) ? 1000 : 0 }).addTo(wpLayer);
    m.on('drag', e=>{
      // náhled: sousední úseky během tažení rovnou čarou
      const ll = e.target.getLatLng();
      if(i > 0 && segLines[i-1]) segLines[i-1].line.setLatLngs([[wps[i-1].lat, wps[i-1].lng], ll]);
      if(i < segs.length && segLines[i]) segLines[i].line.setLatLngs([ll, [wps[i+1].lat, wps[i+1].lng]]);
    });
    m.on('dragend', e=> moveWaypoint(i, e.target.getLatLng()));
    m.on('click', ()=> openWpPopup(i, m));
  });
}

function segModeLabel(mode){ return mode==='route' ? 'po cestách' : mode==='straight' ? 'rovně' : 'původní GPX'; }

function openWpPopup(i, marker){
  const el = document.createElement('div');
  el.className = 'pl-popup';
  const title = i===0 ? 'Start' : (i===wps.length-1 ? 'Cíl' : 'Bod ' + (i+1));
  let html = `<b>${title}</b>`;
  const rows = [];
  if(i > 0) rows.push({ seg:i-1, label:'Úsek sem' });
  if(i < segs.length) rows.push({ seg:i, label:'Úsek dál' });
  rows.forEach(r=>{
    const mode = segs[r.seg].mode;
    html += `<div class="pl-pop-row"><span>${r.label}: <i>${segModeLabel(mode)}</i></span>
      <div class="pl-pop-btns">
        <button type="button" data-seg="${r.seg}" data-mode="route" ${mode==='route'?'disabled':''}>🛣 Po cestách</button>
        <button type="button" data-seg="${r.seg}" data-mode="straight" ${mode==='straight'?'disabled':''}>📏 Rovně</button>
      </div></div>`;
  });
  if(i > 0 && i < wps.length-1){
    const kmBefore = segs.slice(0, i).reduce((a, _, k)=> a + computeStats(segGeometry(k)).distanceKm, 0);
    const kmAfter  = segs.slice(i).reduce((a, _, k)=> a + computeStats(segGeometry(i + k)).distanceKm, 0);
    html += `<div class="pl-pop-row pl-pop-split"><span>✂ Rozdělit trasu tady a smazat:</span>
      <div class="pl-pop-btns">
        <button type="button" data-trim="start">Začátek<small>${kmBefore.toFixed(1)} km</small></button>
        <button type="button" data-trim="end">Konec<small>${kmAfter.toFixed(1)} km</small></button>
      </div></div>`;
  }
  html += `<button type="button" class="pl-pop-del">🗑 Smazat bod</button>`;
  el.innerHTML = html;
  el.querySelectorAll('button[data-seg]').forEach(b=>{
    b.addEventListener('click', ()=>{ map.closePopup(); setSegMode(Number(b.dataset.seg), b.dataset.mode); });
  });
  el.querySelectorAll('button[data-trim]').forEach(b=>{
    b.addEventListener('click', ()=>{ map.closePopup(); trimRoute(i, b.dataset.trim); });
  });
  el.querySelector('.pl-pop-del').addEventListener('click', ()=>{ map.closePopup(); deleteWaypoint(i); });
  L.popup({ offset:[0,-6], closeButton:true, autoPanPadding:[30,30] }).setLatLng(marker.getLatLng()).setContent(el).openOn(map);
}

// výškový profil (stejný vzhled jako v detailu trasy)
function renderElevationProfile(points){
  const hasEle = points.some(p => p[2] != null && !isNaN(p[2]));
  if(points.length < 2 || !hasEle) return '<p class="elev-note">Výškový profil se ukáže, až bude trasa mít úseky s výškou.</p>';
  let dist = 0;
  const series = [];
  for(let i=0;i<points.length;i++){
    if(i>0) dist += haversine(points[i-1], points[i]);
    if(points[i][2] != null) series.push([dist/1000, points[i][2]]);
  }
  if(series.length < 2) return '<p class="elev-note">Bez výškových dat.</p>';
  const eles = series.map(p=>p[1]);
  const minEle = Math.min(...eles), maxEle = Math.max(...eles);
  const maxDist = series[series.length-1][0] || 1;
  const W=300, H=90, PAD=4;
  const sx = d => PAD + (d/maxDist) * (W-2*PAD);
  const sy = e => H-PAD - ((e-minEle)/((maxEle-minEle)||1)) * (H-2*PAD);
  const pathD = series.map((p,i)=> (i===0?'M':'L') + sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1)).join(' ');
  const areaD = pathD + ` L${sx(series[series.length-1][0]).toFixed(1)},${H-PAD} L${sx(0).toFixed(1)},${H-PAD} Z`;
  return `<h3>Výškový profil</h3>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${areaD}" fill="#4F7048" fill-opacity="0.18" stroke="none"></path>
      <path d="${pathD}" fill="none" stroke="#4F7048" stroke-width="2"></path>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--ink-soft);margin-top:4px;">
      <span>${Math.round(minEle)} m</span><span>${Math.round(maxEle)} m</span>
    </div>`;
}

let statsTimer = null;
function renderStats(){
  const pts = assemble();
  const st = computeStats(pts);
  const km = st.distanceKm.toFixed(1).replace('.', ',');
  document.getElementById('pl-dist').textContent = km;
  document.getElementById('pl-gain').textContent = Math.round(st.elevGainM);
  document.getElementById('pl-wps').textContent = wps.length;
  document.getElementById('pl-chip-text').textContent = wps.length===0
    ? 'Klikni do mapy a přidej start trasy'
    : wps.length===1 ? 'Start přidán – klikni na další místo'
    : `${km} km · ↗ ${Math.round(st.elevGainM)} m`;
  document.getElementById('pl-elev').innerHTML = renderElevationProfile(pts);
  const box = document.getElementById('pl-editing-box');
  box.hidden = !editing;
  if(editing){
    document.getElementById('pl-editing-name').textContent = editing.name || 'trasa';
    const link = document.getElementById('pl-editing-link');
    link.hidden = !editing.id;
    if(editing.id) link.href = 'index.html?trasa=' + editing.id;
  }
}

let draftTimer = null;
function saveDraftSoon(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(()=>{
    if(!wps.length && !editing){ try{ localStorage.removeItem(DRAFT_KEY); }catch(e){} return; }
    lsSet(DRAFT_KEY, {
      v:1, wps, editing,
      segs: segs.map(s=>({ mode:s.mode, pts: s.mode==='straight' ? null : s.pts, error:!!s.error }))
    });
  }, 600);
}

// fromRouting=true: jen dorazil výsledek hledání cesty (bez změny bodů)
function changed(fromRouting){
  renderSegs();
  if(!fromRouting) renderWps();
  clearTimeout(statsTimer);
  statsTimer = setTimeout(renderStats, fromRouting ? 120 : 0);
  saveDraftSoon();
  updateUndoButtons();
}

// ---------------------------------------------------------------
// Ovládání
// ---------------------------------------------------------------
function setDrawMode(mode){
  settings.drawMode = mode;
  saveSettings();
  document.getElementById('mode-route').classList.toggle('active', mode==='route');
  document.getElementById('mode-straight').classList.toggle('active', mode==='straight');
}
document.getElementById('mode-route').addEventListener('click', ()=>{ setDrawMode('route'); toast('Nové úseky se povedou po cestách.'); });
document.getElementById('mode-straight').addEventListener('click', ()=>{ setDrawMode('straight'); toast('Nové úseky se kreslí rovně – nezávisle na mapě.'); });
setDrawMode(settings.drawMode);

const prefEl = document.getElementById('pl-pref');
const pathsEl = document.getElementById('pl-paths');
prefEl.value = settings.pref;
pathsEl.checked = !!settings.allowPaths;
function onPrefChange(){
  settings.pref = prefEl.value;
  settings.allowPaths = pathsEl.checked;
  saveSettings();
  if(segs.some(s=>s.mode==='route')){
    rerouteAll();
    toast('Úseky po cestách se přepočítávají podle nové preference.');
  }
}
prefEl.addEventListener('change', onPrefChange);
pathsEl.addEventListener('change', onPrefChange);

document.getElementById('pl-undo').addEventListener('click', undo);
document.getElementById('pl-undo-qb').addEventListener('click', undo);
document.getElementById('pl-redo').addEventListener('click', redo);
document.getElementById('pl-reverse').addEventListener('click', reverseRoute);
document.getElementById('pl-clear').addEventListener('click', clearAll);
document.addEventListener('keydown', e=>{
  if(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
  else if((e.ctrlKey || e.metaKey) && (e.key.toLowerCase()==='y' || (e.key.toLowerCase()==='z' && e.shiftKey))){ e.preventDefault(); redo(); }
});

// boční panel (na mobilu se vysouvá jazýčkem)
const panel = document.getElementById('pl-panel');
if(window.matchMedia('(max-width:760px)').matches || localStorage.getItem('plPanelCollapsed')==='1') panel.classList.add('collapsed');
document.getElementById('pl-panel-tab').addEventListener('click', ()=>{
  panel.classList.toggle('collapsed');
  try{ localStorage.setItem('plPanelCollapsed', panel.classList.contains('collapsed') ? '1' : '0'); }catch(e){}
});

// poloha
let meMarker = null;
document.getElementById('pl-locate').addEventListener('click', ()=>{
  if(!navigator.geolocation){ toast('Prohlížeč nepodporuje GPS polohu.'); return; }
  toast('Zjišťuji polohu…', 2000);
  navigator.geolocation.getCurrentPosition(pos=>{
    const ll = [pos.coords.latitude, pos.coords.longitude];
    if(!meMarker) meMarker = L.circleMarker(ll, { radius:8, color:'#fff', weight:3, fillColor:'#1E64D6', fillOpacity:1, interactive:false }).addTo(map);
    else meMarker.setLatLng(ll);
    map.setView(ll, Math.max(map.getZoom(), 14));
  }, err=> toast('Polohu se nepodařilo zjistit: ' + (err.message || 'neznámá chyba')), { enableHighAccuracy:true, timeout:15000, maximumAge:30000 });
});

// ---------------------------------------------------------------
// Ostatní trasy CendurOFF (podklad + výběr k úpravě)
// ---------------------------------------------------------------
let allRoutes = [];
async function loadRouteList(){
  const sel = document.getElementById('pl-route-select');
  try{
    allRoutes = await api('/api/routes');
    allRoutes.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''), 'cs', { sensitivity:'base', numeric:true }));
  }catch(e){
    sel.innerHTML = '<option value="">Trasy se nepodařilo načíst</option>';
    return;
  }
  // k úpravě se nabízejí jen vlastní trasy; admin vidí i trasy ostatních
  const mine = currentUser ? allRoutes.filter(r=>r.owner_id===currentUser.id) : [];
  const others = isAdminUser() ? allRoutes.filter(r=>r.owner_id!==currentUser.id) : [];
  const opt = r=>`<option value="${r.id}">${escapeHtml(r.name)} (${Number(r.distance_km).toFixed(1)} km)</option>`;
  const optOther = r=>`<option value="${r.id}">${escapeHtml(r.name)} – ${escapeHtml(r.owner_display || '')} (${Number(r.distance_km).toFixed(1)} km)</option>`;
  if(!currentUser){
    sel.innerHTML = '<option value="">Pro úpravu tras se přihlas v Atlasu</option>';
  } else if(!mine.length && !others.length){
    sel.innerHTML = '<option value="">Zatím nemáš žádnou vlastní trasu</option>';
  } else {
    sel.innerHTML = '<option value="">— vyber svou trasu —</option>' +
      (mine.length ? `<optgroup label="Moje trasy">${mine.map(opt).join('')}</optgroup>` : '') +
      (others.length ? `<optgroup label="Trasy ostatních (admin)">${others.map(optOther).join('')}</optgroup>` : '');
  }
  drawOthers();
}
function drawOthers(){
  othersLayer.clearLayers();
  if(!settings.showRoutes) return;
  allRoutes.forEach(r=>{
    if(editing && Number(editing.id)===Number(r.id)) return; // upravovaná trasa se kreslí jako plán
    const color = (ROUTE_TYPES[r.route_type] || ROUTE_TYPES.offroad).color;
    L.polyline(r.points.map(p=>[p[0],p[1]]), { pane:'pl-others', color, weight:4, opacity:0.7, interactive:false }).addTo(othersLayer);
  });
}
const showRoutesEl = document.getElementById('pl-show-routes');
showRoutesEl.checked = !!settings.showRoutes;
showRoutesEl.addEventListener('change', ()=>{ settings.showRoutes = showRoutesEl.checked; saveSettings(); drawOthers(); });

function confirmReplace(what){
  if(!wps.length) return true;
  return confirm('V plánovači máš rozpracovanou trasu. Nahradit ji ' + what + '? (Jde to vrátit tlačítkem Zpět.)');
}

async function openRouteById(id, askFirst){
  let data;
  try{ data = await api('/api/routes/' + id); }
  catch(e){ toast('Trasu se nepodařilo načíst: ' + e.message, 5000); return false; }
  const r = data.route;
  if(!canEditRoute(r.owner_id)){
    toast(currentUser ? 'Upravovat v plánovači můžeš jen trasy, které jsi nahrál(a) ty.' : 'Pro úpravu svých tras se nejdřív přihlas v Atlasu.', 5000);
    return false;
  }
  if(askFirst && !confirmReplace('trasou „' + r.name + '“')) return false;
  try{
    loadPoints(r.points, { id:r.id, name:r.name, description:r.description || '', route_type:r.route_type, owner_id:r.owner_id, owner_display:r.owner_display });
  }catch(e){ toast(e.message); return false; }
  drawOthers();
  const own = currentUser && currentUser.id === r.owner_id;
  toast(own ? 'Trasa otevřena – můžeš ji upravit a uložit změny.' : 'Trasa otevřena jako admin (patří uživateli ' + (r.owner_display || '?') + ').', 5000);
  return true;
}
document.getElementById('pl-open-route').addEventListener('click', ()=>{
  const id = document.getElementById('pl-route-select').value;
  if(!id){ toast('Nejdřív vyber trasu ze seznamu.'); return; }
  openRouteById(id, true).then(ok=>{ if(ok && window.matchMedia('(max-width:760px)').matches) panel.classList.add('collapsed'); });
});
document.getElementById('pl-gpx-file').addEventListener('change', async e=>{
  const f = e.target.files[0];
  e.target.value = '';
  if(!f) return;
  try{
    const { points, suggestedName } = parseGPX(await f.text());
    if(!confirmReplace('souborem ' + f.name)) return;
    loadPoints(points, { id:null, name: suggestedName || f.name.replace(/\.gpx$/i,''), description:'', route_type:'' });
    drawOthers();
    toast('GPX načteno – body můžeš tahat, mazat a doplňovat.', 4000);
    if(window.matchMedia('(max-width:760px)').matches) panel.classList.add('collapsed');
  }catch(err){ toast(err.message || 'GPX se nepodařilo načíst.'); }
});

// ---------------------------------------------------------------
// Uložení
// ---------------------------------------------------------------
const saveOverlay = document.getElementById('pl-save-overlay');
function isOwnerOfEditing(){ return !!(editing && editing.id && canEditRoute(editing.owner_id)); }
function openSaveDialog(){
  const pts = assemble();
  if(pts.length < 2){ toast('Trasa musí mít aspoň dva body.'); return; }
  const pending = segs.filter(s=>s.loading);
  if(pending.length){
    // pojistka: když fronta nic nepočítá, úsek "visí" - spustíme výpočet znovu
    if(running + queue.length === 0) pending.forEach(s=>{ if(s.mode==='route') requestRoute(s); else s.loading = false; });
    toast(`Trasa zatím NENÍ uložená – ještě se dopočítává ${pending.length === 1 ? '1 úsek' : pending.length + ' úseků'}. Zkus Uložit za pár vteřin.`, 4500);
    return;
  }
  const st = computeStats(pts);
  document.getElementById('pl-save-sub').textContent =
    `${st.distanceKm.toFixed(1).replace('.', ',')} km · ${Math.round(st.elevGainM)} m převýšení · ${pts.length} bodů GPX` +
    (segs.some(s=>s.error) ? ' · pozor: některé úseky nešlo najít po cestách (jsou rovně)' : '');
  document.getElementById('pl-name').value = (editing && editing.name) || '';
  document.getElementById('pl-desc').value = (editing && editing.description) || '';
  document.getElementById('pl-type').value = (editing && editing.route_type) || '';
  const msg = document.getElementById('pl-save-msg');
  msg.style.color = '';
  msg.innerHTML = currentUser ? '' : 'Pro uložení do CendurOFF se musíš <a href="index.html?atlas=1">přihlásit na hlavní stránce</a>. GPX si můžeš stáhnout i bez přihlášení.';
  document.getElementById('pl-save-overwrite').style.display = isOwnerOfEditing() ? '' : 'none';
  const newBtn = document.getElementById('pl-save-new');
  newBtn.className = isOwnerOfEditing() ? 'ghost-btn pl-full' : 'primary-btn';
  newBtn.disabled = !currentUser;
  document.getElementById('pl-save-overwrite').disabled = !currentUser;
  saveOverlay.classList.add('open');
}
document.getElementById('pl-save').addEventListener('click', openSaveDialog);
document.getElementById('pl-save-qb').addEventListener('click', openSaveDialog);
document.getElementById('pl-save-close').addEventListener('click', ()=> saveOverlay.classList.remove('open'));
saveOverlay.addEventListener('click', e=>{ if(e.target===saveOverlay) saveOverlay.classList.remove('open'); });

function formValues(){
  return {
    name: document.getElementById('pl-name').value.trim(),
    description: document.getElementById('pl-desc').value.trim(),
    routeType: document.getElementById('pl-type').value
  };
}
async function doSave(overwrite){
  const msg = document.getElementById('pl-save-msg');
  msg.style.color = '';
  const v = formValues();
  if(!v.name){ msg.textContent = 'Zadejte název trasy.'; return; }
  if(!v.routeType){ msg.textContent = 'Vyberte typ trasy.'; return; }
  const points = assemble();
  if(points.length < 2){ msg.textContent = 'Trasa musí mít aspoň dva body.'; return; }
  if(overwrite && !confirm('Přepsat uloženou trasu „' + editing.name + '“ touto verzí?')) return;
  msg.textContent = 'Ukládám…';
  const buttons = saveOverlay.querySelectorAll('button');
  buttons.forEach(b=>b.disabled = true);
  try{
    const body = JSON.stringify({ name:v.name, description:v.description, routeType:v.routeType, points });
    const saved = overwrite
      ? await api('/api/routes/' + editing.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body })
      : await api('/api/routes', { method:'POST', headers:{'Content-Type':'application/json'}, body });
    editing = { id:saved.id, name:saved.name, description:saved.description || '', route_type:saved.route_type,
                owner_id: overwrite ? editing.owner_id : currentUser.id, owner_display: overwrite ? editing.owner_display : currentUser.displayName };
    saveOverlay.classList.remove('open');
    renderStats();
    saveDraftSoon();
    loadRouteList();
    toast(overwrite ? 'Změny trasy uloženy.' : 'Trasa uložena do CendurOFF.', 4000);
  }catch(e){
    msg.textContent = e.message || 'Trasu se nepodařilo uložit.';
  }finally{
    buttons.forEach(b=>b.disabled = false);
    if(!currentUser){ document.getElementById('pl-save-new').disabled = true; document.getElementById('pl-save-overwrite').disabled = true; }
  }
}
document.getElementById('pl-save-overwrite').addEventListener('click', ()=> doSave(true));
document.getElementById('pl-save-new').addEventListener('click', ()=> doSave(false));
function downloadCurrent(){
  const pts = assemble();
  if(pts.length < 2){ toast('Trasa musí mít aspoň dva body.'); return; }
  const name = (saveOverlay.classList.contains('open') && document.getElementById('pl-name').value.trim()) || (editing && editing.name) || 'CendurOFF_planovac';
  downloadGPX(pts, name);
}
document.getElementById('pl-download').addEventListener('click', downloadCurrent);
document.getElementById('pl-save-download').addEventListener('click', downloadCurrent);

// ---------------------------------------------------------------
// Start stránky
// ---------------------------------------------------------------
function restoreDraft(){
  const d = lsGet(DRAFT_KEY, null);
  if(!d || !Array.isArray(d.wps) || !Array.isArray(d.segs) || d.segs.length !== Math.max(0, d.wps.length-1)) return false;
  wps = d.wps;
  segs = d.segs.map(s=>newSeg(s.mode, s.pts));
  segs.forEach((s,i)=>{ s.error = !!d.segs[i].error; if(s.mode==='route' && !s.pts) requestRoute(s); });
  editing = d.editing || null;
  // rozpracovaná úprava cizí trasy (např. z dřívější verze nebo po odhlášení) se nepovoluje
  if(editing && editing.id && !canEditRoute(editing.owner_id)){
    wps = []; segs = []; editing = null;
    try{ localStorage.removeItem(DRAFT_KEY); }catch(e){}
    changed();
    return false;
  }
  changed();
  fitToRoute();
  return wps.length > 0;
}

(async function boot(){
  try{ currentUser = await api('/api/auth/me'); }catch(e){ currentUser = null; }
  if(!currentUser){
    // Plánovač je jen pro přihlášené členy - pošleme na přihlášení a po něm zpátky sem.
    // Pojistka proti nekonečnému přeskakování Atlas <-> Plánovač: když se to během chvíle
    // opakuje, přestaneme přesměrovávat a ukážeme hlášku.
    let hops = [];
    try{ hops = JSON.parse(sessionStorage.getItem('plAuthHops') || '[]').filter(t=>Date.now()-t < 20000); }catch(e){}
    if(hops.length >= 2){
      try{ sessionStorage.removeItem('plAuthHops'); }catch(e){}
      document.body.classList.remove('auth-pending');
      document.getElementById('app-screen').innerHTML =
        '<div style="margin:auto;max-width:420px;padding:32px;text-align:center;font-family:Roboto,sans-serif">' +
        '<h2 style="font-family:\'Exo 2\',sans-serif">Přihlášení se nepodařilo ověřit</h2>' +
        '<p>Server teď neodpovídá nebo prohlížeč blokuje přihlašovací cookie. Zkus to prosím za chvíli znovu.</p>' +
        '<p><a href="index.html?atlas=1">Přejít do Atlasu</a></p></div>';
      return;
    }
    hops.push(Date.now());
    try{ sessionStorage.setItem('plAuthHops', JSON.stringify(hops)); }catch(e){}
    const back = 'planovac.html' + location.search;
    location.replace('index.html?next=' + encodeURIComponent(back));
    return;
  }
  try{ sessionStorage.removeItem('plAuthHops'); }catch(e){}
  document.body.classList.remove('auth-pending');
  if(window.CendurHeader) window.CendurHeader.setUser(currentUser);

  const params = new URLSearchParams(location.search);
  const routeId = Number(params.get('trasa'));
  const hadDraft = restoreDraft();
  const listPromise = loadRouteList();

  if(params.get('import')){
    const imp = lsGet(IMPORT_KEY, null);
    try{ localStorage.removeItem(IMPORT_KEY); }catch(e){}
    if(imp && Array.isArray(imp.points)){
      if(!hadDraft || confirmReplace('záznamem jízdy')){
        try{
          loadPoints(imp.points, { id:null, name:imp.name || '', description:imp.description || '', route_type:imp.routeType || '' });
          toast('Záznam jízdy je v plánovači – uprav ho a ulož.', 5000);
        }catch(e){ toast(e.message); }
      }
    }
  } else if(Number.isInteger(routeId) && routeId > 0){
    const same = editing && Number(editing.id) === routeId && hadDraft;
    if(same) toast('Pokračuješ v rozpracované úpravě trasy „' + editing.name + '“.', 4000);
    else await openRouteById(routeId, hadDraft);
  } else if(hadDraft){
    toast('Obnovena rozpracovaná trasa z minula.', 3500);
  }
  // adresu uklidíme, ať obnovení stránky neotevírá trasu znovu přes rozpracovaný plán
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
  await listPromise;
  drawOthers();
  updateUndoButtons();
  renderStats();
})();

})();
