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
  // v4.6: body (wpt) – např. export míst z Mapy.com; spojí se po cestách v pořadí ze souboru
  const wpt = Array.from(doc.getElementsByTagName('wpt'));
  const wptPoints = wpt.map(p=>[parseFloat(p.getAttribute('lat')), parseFloat(p.getAttribute('lon')), null]).filter(p=>!isNaN(p[0]) && !isNaN(p[1]));
  if(pts.length===0 && wptPoints.length < 2) throw new Error('V souboru nebyly nalezeny žádné body trasy.');
  const points = pts.map(p=>{
    const lat = parseFloat(p.getAttribute('lat'));
    const lon = parseFloat(p.getAttribute('lon'));
    const eleEl = p.getElementsByTagName('ele')[0];
    const ele = eleEl ? parseFloat(eleEl.textContent) : null;
    return [lat, lon, (ele==null || isNaN(ele)) ? null : ele];
  }).filter(p=>!isNaN(p[0]) && !isNaN(p[1]));
  const nameEl = doc.querySelector('metadata > name, trk > name, rte > name');
  return { points, suggestedName: nameEl ? nameEl.textContent.trim() : '', wptPoints };
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
// v4.7: engine = podklad pro hledání cesty – 'mapy' (Mapy.com, turistické stezky; výchozí) nebo 'osm' (BRouter / OpenStreetMap);
// mění se v Nastavení účtu → Plánovač
const settings = Object.assign({ drawMode:'route', pref:'teren', allowPaths:true, showRoutes:true, engine:'mapy' }, lsGet(SETTINGS_KEY, {}));
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

// ---------------------------------------------------------------
// v4.7: hledání cesty přes Mapy.com (REST API routing + výšky z elevation API)
//   Terén → foot_hiking (preferuje značené turistické stezky), Mix → bike_mountain, Silnice → car_short
// ---------------------------------------------------------------
const MAPY_API = 'https://api.mapy.com/v1';
const MAPY_TYPES = { teren:'foot_hiking', mix:'bike_mountain', silnice:'car_short' };
let mapyDown = 0;   // čas, do kdy Mapy.com nepoužívat (výpadek / limit) – mezitím se hledá přes OSM
function mapyKey(){ return (window.CendurMaps && window.CendurMaps.MAPY_KEY) || ''; }
async function mapyElevation(coords){
  // nejvýš 256 bodů na dotaz – vezmeme rovnoměrný výběr a mezi nimi výšku dopočítáme
  const n = coords.length, step = Math.max(1, Math.ceil(n / 250));
  const idx = []; for(let i=0;i<n;i+=step) idx.push(i); if(idx[idx.length-1] !== n-1) idx.push(n-1);
  const pos = idx.map(i => coords[i][0].toFixed(6) + ',' + coords[i][1].toFixed(6)).join(';');
  const res = await fetch(`${MAPY_API}/elevation?positions=${pos}&apikey=${encodeURIComponent(mapyKey())}`);
  if(!res.ok) throw new Error('elevation ' + res.status);
  const items = (await res.json()).items || [];
  if(items.length !== idx.length) throw new Error('elevation count');
  const ele = new Array(n).fill(null);
  idx.forEach((k, j) => { const e = items[j].elevation; ele[k] = (e == null || e < -1000) ? null : e; });
  for(let j=0;j<idx.length-1;j++){
    const a = idx[j], b = idx[j+1], ea = ele[a], eb = ele[b];
    if(ea == null || eb == null) continue;
    for(let k=a+1;k<b;k++) ele[k] = ea + (eb - ea) * (k - a) / (b - a);
  }
  return ele;
}
async function fetchRouteMapy(a, b){
  const type = MAPY_TYPES[settings.pref] || 'foot_hiking';
  const url = `${MAPY_API}/routing/route?start=${a.lng.toFixed(6)},${a.lat.toFixed(6)}&end=${b.lng.toFixed(6)},${b.lat.toFixed(6)}` +
              `&routeType=${type}&format=geojson&lang=cs&apikey=${encodeURIComponent(mapyKey())}`;
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 25000);
  let res, data = null;
  try{
    res = await fetch(url, { signal:ctrl.signal });
    try{ data = await res.json(); }catch(e){}
  }catch(e){
    throw new Error(e && e.name === 'AbortError' ? 'timeout' : (e.message || String(e)));
  }finally{ clearTimeout(timer); }
  if(!res.ok){
    const code = data && Array.isArray(data.detail) && data.detail[0] && data.detail[0].errorCode;
    if(res.status === 404 && code === 7) throw new Error('position not mapped');
    if(res.status === 404 && code === 9) throw new Error('island');
    const err = new Error('Mapy.com ' + res.status); err.mapyDown = res.status !== 404 && res.status !== 422; throw err;
  }
  const coords = data && data.geometry && data.geometry.geometry && data.geometry.geometry.coordinates;
  if(!coords || coords.length < 2) throw new Error('prázdná trasa');
  let ele = null;
  try{ ele = await mapyElevation(coords); }catch(e){ /* bez výšek – trasa se i tak nakreslí */ }
  return coords.map((c, i) => [c[1], c[0], ele && ele[i] != null ? Math.round(ele[i] * 10) / 10 : null]);
}

async function fetchRoute(a, b, retried){
  if(settings.engine !== 'osm' && Date.now() > mapyDown && mapyKey()){
    try{ return await fetchRouteMapy(a, b); }
    catch(e){
      if(!e.mapyDown && !/Failed to fetch|NetworkError|Load failed|timeout/i.test(e.message)) throw e;
      // Mapy.com nedostupné / došel limit → 10 minut hledat přes OpenStreetMap
      mapyDown = Date.now() + 10 * 60000;
      toast('Mapy.com teď cestu nenašly (' + e.message + ') – plánuju podle OpenStreetMap.', 5000);
    }
  }
  return fetchRouteOsm(a, b, retried);
}
async function fetchRouteOsm(a, b, retried){
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
    if(!retried && /profile/i.test(text)) return fetchRouteOsm(a, b, true);
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
window.CendurPlannerMap = map;   // pro testy / ladění
// v3.8: podkladové mapy – turistická Mapy.com a satelit (public/basemaps.js), společné s Atlasem
const baseCtl = window.CendurMaps.attach(map, { toast: t => toast(t, 1800) });

// tlačítka mapy jako v Atlasu: 🗺 (nabídka podkladů), +, −
// v3.6: společná funkce přibližování (public/zoom.js)
window.CendurZoom.bind(map, { in1:'pl-zoom-in', out1:'pl-zoom-out', in3:'pl-zoom-in3', out3:'pl-zoom-out3' }, { min:3, max:19 });
const layersBtn = document.getElementById('pl-layers-btn');
document.body.insertAdjacentHTML('beforeend', `<div id="layer-menu" role="menu">
  <div class="layer-menu-title">Podkladová mapa</div>
</div>`);
const layerMenu = document.getElementById('layer-menu');
// klepnutí = přepnout Mapy.com / satelit, podržení = benzínky, CHKO
baseCtl.bindButton(layersBtn, ()=>{ placeLayerMenu(); layerMenu.classList.add('open'); });
baseCtl.renderMenu(layerMenu);
function placeLayerMenu(){
  const r = layersBtn.getBoundingClientRect();
  layerMenu.style.left = 'auto';
  layerMenu.style.top = Math.round(r.top) + 'px';
  layerMenu.style.right = Math.max(8, Math.round(window.innerWidth - r.left + 8)) + 'px';
  layerMenu.style.maxHeight = Math.max(160, window.innerHeight - r.top - 8) + 'px';
  layerMenu.style.overflowY = 'auto';
}
document.addEventListener('click', (e)=>{
  if(layerMenu.classList.contains('open') && !layerMenu.contains(e.target) && e.target !== layersBtn) layerMenu.classList.remove('open');
});
window.addEventListener('resize', ()=>{ if(layerMenu.classList.contains('open')) placeLayerMenu(); });
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
  if(crossMode){ crossAt(e.latlng); return; }
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

// ---------------------------------------------------------------
// v4.11: přepojení křížení – klepnutím na místo, kde se trasa kříží, se obě linie v tom místě
// rozpojí a spojí obráceně (2-opt): smyčka mezi nimi se projede opačným směrem.
// Geometrie zůstane stejná – úseky se jen otočí, nic se nepřepočítává.
// ---------------------------------------------------------------
let crossMode = false;
const crossBar = document.createElement('div');
crossBar.className = 'pl-crossbar'; crossBar.hidden = true;
crossBar.innerHTML = '<span>✂ Klepni na místo, kde se trasa kříží</span><button type="button">Zrušit</button>';
map.getContainer().appendChild(crossBar);
L.DomEvent.disableClickPropagation(crossBar);
crossBar.querySelector('button').addEventListener('click', ()=> setCrossMode(false));
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && crossMode) setCrossMode(false); });
function setCrossMode(on){
  crossMode = !!on;
  crossBar.hidden = !crossMode;
  document.body.classList.toggle('pl-cross-mode', crossMode);
}
function splitSegAt(k, n){
  const g = segGeometry(k), s = segs[k];
  const p = [n.lat, n.lng, n.ele];
  const s1 = newSeg(s.mode, s.mode==='straight' ? null : g.slice(0, n.k+1).concat([p]));
  const s2 = newSeg(s.mode, s.mode==='straight' ? null : [p].concat(g.slice(n.k+1)));
  s1.error = s2.error = s.error;
  s.req++;
  wps.splice(k+1, 0, { lat:n.lat, lng:n.lng, ele:n.ele, small:true });
  segs.splice(k, 1, s1, s2);
  if(s.mode==='route' && (s.loading || s.error || !s.pts)){ s1.pts = s2.pts = null; requestRoute(s1); requestRoute(s2); }
  return k+1;
}
function crossAt(ll){
  if(segs.length < 1){ toast('Nejdřív potřebuješ trasu.'); return; }
  // tolerance ~22 px na obrazovce
  const p0 = map.latLngToContainerPoint(ll);
  const tol = Math.max(8, map.distance(ll, map.containerPointToLatLng(p0.add([22, 0]))));
  // všechny průchody trasy kolem místa klepnutí (s polohou podél trasy)
  const hits = [];
  let along = 0;
  segs.forEach((s, k)=>{
    const g = segGeometry(k);
    const lens = []; let L0 = 0;
    for(let q=0;q<g.length-1;q++){ lens.push(L0); L0 += map.distance([g[q][0],g[q][1]], [g[q+1][0],g[q+1][1]]); }
    for(let q=0;q<g.length-1;q++){
      const n = nearestOnLine([g[q], g[q+1]], ll);
      if(!n) continue;
      const d = map.distance(ll, [n.lat, n.lng]);
      if(d <= tol){
        const segLen = map.distance([g[q][0],g[q][1]], [g[q+1][0],g[q+1][1]]);
        hits.push({ k, q, d, along: along + lens[q] + n.t * segLen, n: Object.assign({}, n, { k:q }) });
      }
    }
    along += L0;
  });
  hits.sort((a, b)=> a.d - b.d);
  const h1 = hits[0];
  const minGap = Math.max(60, tol * 4);
  const h2 = h1 && hits.find(h => Math.abs(h.along - h1.along) > minGap);
  if(!h1 || !h2){ toast('Tady se trasa nekříží – klepni přesně na místo, kde se čáry protínají.', 3500); return; }
  pushUndo();
  // nejdřív rozdělit ten průchod, který je dál podél trasy (indexy dřívějšího se nezmění)
  const [early, late] = h1.along < h2.along ? [h1, h2] : [h2, h1];
  let b = splitSegAt(late.k, late.n);
  let a = splitSegAt(early.k, early.n);
  if(late.k > early.k || (late.k === early.k)) b += 1;   // vložení dřívějšího bodu posunulo pozdější o 1
  // a = T1 (dřívější), b = T2 (pozdější); obrátit vše mezi nimi
  const T1 = wps[a], T2 = wps[b];
  const mid = segs.slice(a, b).reverse().map(s=>{
    const r = newSeg(s.mode, s.pts ? s.pts.slice().reverse() : null);
    r.error = s.error; if(s.loading) s.req++;
    return r;
  });
  const fix = (seg, first, last)=>{
    if(!seg.pts || seg.mode === 'straight') return;
    const pts = seg.pts.slice();
    if(first) pts[0] = [first.lat, first.lng, first.ele];
    if(last) pts[pts.length-1] = [last.lat, last.lng, last.ele];
    seg.pts = pts;
  };
  if(mid.length === 1) fix(mid[0], T1, T2);
  else { fix(mid[0], T1, null); fix(mid[mid.length-1], null, T2); }
  const midW = wps.slice(a+1, b).reverse();
  wps = wps.slice(0, a+1).concat(midW, wps.slice(b));
  segs = segs.slice(0, a).concat(mid, segs.slice(b));
  segs.forEach(s=>{ if(s.mode==='route' && !s.pts && !s.loading) requestRoute(s); });
  setCrossMode(false);
  changed();
  toast('Křížení přepojeno – smyčka se teď projede obráceně. (Vrátíš tlačítkem Zpět.)', 4500);
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

// v4.6: načtení samotných bodů (wpt) – každý bod je zastávka, úseky mezi nimi se naplánují po cestách
function loadWaypoints(points, meta){
  if(points.length < 2) throw new Error('Soubor nemá dost bodů.');
  pushUndo();
  segs.forEach(s=>s.req++);
  wps = points.map(p=>({ lat:p[0], lng:p[1], ele:null, small:false }));
  segs = [];
  for(let j=0;j<wps.length-1;j++) segs.push(newSeg('route', null));
  editing = meta || null;
  segs.forEach(s=>requestRoute(s));
  changed();
  fitToRoute();
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
      if(crossMode){ crossAt(e.latlng); return; }
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
    m.on('click', ()=>{ if(crossMode){ crossAt(m.getLatLng()); return; } openWpPopup(i, m); });
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
    ? 'Klepni do mapy a přidej start'
    : wps.length===1 ? 'Start přidán – klepni na další místo'
    : `${km} km · ↗ ${Math.round(st.elevGainM)} m`;
  document.getElementById('pl-head-title').textContent = editing && editing.id ? '✎ ' + (editing.name || 'trasa') : (editing && editing.name ? editing.name : 'Nová trasa');
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
// v4.13: dirty = v plánovači jsou neuložené změny. Otevřená uložená trasa bez úprav se při příštím
// otevření plánovače neobnovuje – plánovač pak začíná s novou trasou.
let dirty = false;
function saveDraftSoon(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(()=>{
    if(!wps.length && !editing){ try{ localStorage.removeItem(DRAFT_KEY); }catch(e){} return; }
    lsSet(DRAFT_KEY, {
      v:1, wps, editing, dirty,
      segs: segs.map(s=>({ mode:s.mode, pts: s.mode==='straight' ? null : s.pts, error:!!s.error }))
    });
  }, 600);
}

// fromRouting=true: jen dorazil výsledek hledání cesty (bez změny bodů)
function changed(fromRouting){
  if(!fromRouting) dirty = true;
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

// v4.7: v nabídce jen nenápadně ukázat, podle čeho se hledá (mění se v Nastavení)
(function(){
  const h = document.getElementById('pl-engine-hint'), pc = document.getElementById('pl-paths');
  const mapy = settings.engine !== 'osm';
  if(h) h.innerHTML = mapy
    ? 'Hledá se po cestách z <b>Mapy.com</b> (Terén = turistické stezky). Kde cesta chybí, přepni dole na <b>📏 Rovně</b>. <a href="nastaveni.html#s-plan">Podklad změníš v Nastavení</a>.'
    : 'Hledá se po cestách z <b>OpenStreetMap</b>. Kde cesta v mapě chybí, přepni dole na <b>📏 Rovně</b>. <a href="nastaveni.html#s-plan">Podklad změníš v Nastavení</a>.';
  if(pc && mapy) pc.closest('label').style.setProperty('display', 'none', 'important');   // pěšiny jdou nastavit jen u OSM
})();
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
document.getElementById('pl-redo').addEventListener('click', redo);
document.getElementById('pl-reverse').addEventListener('click', ()=>{ closeSheet(); reverseRoute(); });
document.getElementById('pl-cross').addEventListener('click', ()=>{
  closeSheet();
  if(segs.length < 1){ toast('Nejdřív potřebuješ trasu.'); return; }
  setCrossMode(true);
});
document.getElementById('pl-clear').addEventListener('click', ()=>{ closeSheet(); clearAll(); });
document.addEventListener('keydown', e=>{
  if(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='z' && !e.shiftKey){ e.preventDefault(); undo(); }
  else if((e.ctrlKey || e.metaKey) && (e.key.toLowerCase()==='y' || (e.key.toLowerCase()==='z' && e.shiftKey))){ e.preventDefault(); redo(); }
});

// v3.5: okno „⋯ Více“ (detail trasy, GPX, nastavení hledání cesty) místo bočního panelu
const sheet = document.getElementById('pl-sheet');
function openSheet(){ renderStats(); syncPrefSeg(); sheet.classList.add('open'); }
function closeSheet(){ sheet.classList.remove('open'); }
document.getElementById('pl-more').addEventListener('click', openSheet);
document.getElementById('pl-head').addEventListener('click', openSheet);
document.getElementById('pl-sheet-close').addEventListener('click', closeSheet);
sheet.addEventListener('click', e=>{ if(e.target === sheet) closeSheet(); });
document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeSheet(); });
function syncPrefSeg(){
  document.querySelectorAll('.pl-pref-seg button').forEach(b=> b.classList.toggle('active', b.dataset.pref === prefEl.value));
}
document.querySelectorAll('.pl-pref-seg button').forEach(b=> b.addEventListener('click', ()=>{
  if(prefEl.value === b.dataset.pref) return;
  prefEl.value = b.dataset.pref; syncPrefSeg(); onPrefChange();
}));
syncPrefSeg();

// poloha – v4.0.2: stejná šipka a stejný zdroj polohy jako Atlas NAVI (public/gps.js);
// první klepnutí zapne sledování polohy a vycentruje mapu, další klepnutí mapu znovu vycentruje
let meArrow = null, meWatch = null, meCenterNext = false;
window.CendurZoom.tap(document.getElementById('pl-locate'), ()=>{
  if(!window.CendurGPS){ toast('Prohlížeč nepodporuje GPS polohu.'); return; }
  if(meArrow && meArrow.latlng){ map.setView(meArrow.latlng, Math.max(map.getZoom(), 14)); return; }
  meCenterNext = true;
  if(meWatch) return;
  toast('Zjišťuji polohu…', 2000);
  if(!meArrow) meArrow = window.CendurGPS.arrow(map);
  meWatch = window.CendurGPS.watch(pos=>{
    const c = pos.coords, ll = [c.latitude, c.longitude];
    meArrow.set(ll, c.accuracy, (c.speed > 1.5 && c.heading != null) ? c.heading : null);
    if(meCenterNext){ meCenterNext = false; map.setView(ll, Math.max(map.getZoom(), 14)); }
  }, err=>{
    if(err && err.code === 1){ toast('Bez povolení polohy to nejde.', 4000); if(meWatch){ meWatch.stop(); meWatch = null; } }
  });
});

// ---------------------------------------------------------------
// Ostatní trasy CendurOFF (podklad + výběr k úpravě)
// ---------------------------------------------------------------
let allRoutes = [];
async function loadRouteList(){
  const sel = document.getElementById('pl-route-select') || document.createElement('select');
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
    const ll = r.points.map(p=>[p[0],p[1]]);
    const line = L.polyline(ll, { pane:'pl-others', color, weight:4, opacity:0.7, interactive:false }).addTo(othersLayer);
    // v3.4: trasy, které smím upravit, jdou otevřít klepnutím přímo na mapě
    if(!canEditRoute(r.owner_id)) return;
    const hit = L.polyline(ll, { pane:'pl-others', color:'#000', weight:18, opacity:0, bubblingMouseEvents:false }).addTo(othersLayer);
    hit.on('mouseover', ()=> line.setStyle({ weight:7, opacity:1 }));
    hit.on('mouseout', ()=> line.setStyle({ weight:4, opacity:0.7 }));
    hit.on('click', e=>{ L.DomEvent.stopPropagation(e); openOtherPopup(r, e.latlng); });
  });
}
function openOtherPopup(r, latlng){
  const el = document.createElement('div');
  el.className = 'pl-popup';
  const own = currentUser && Number(currentUser.id) === Number(r.owner_id);
  el.innerHTML = `<b>${escapeHtml(r.name)}</b>
    <div class="pl-pop-row">${(ROUTE_TYPES[r.route_type] || ROUTE_TYPES.offroad).label} · ${Number(r.distance_km).toFixed(1)} km${own ? '' : ' · ' + escapeHtml(r.owner_display || 'jiný uživatel')}</div>
    <div class="pl-pop-btns pl-pop-other">
      <button type="button" class="pl-pop-edit">✎ Upravit tuto trasu</button>
      <button type="button" class="pl-pop-add">+ Přidat bod sem</button>
    </div>`;
  el.querySelector('.pl-pop-edit').addEventListener('click', ()=>{
    map.closePopup();
    openRouteById(r.id, true);
  });
  el.querySelector('.pl-pop-add').addEventListener('click', ()=>{ map.closePopup(); addPoint(latlng); });
  L.popup({ closeButton:true, autoPanPadding:[30,30] }).setLatLng(latlng).setContent(el).openOn(map);
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
  dirty = false; saveDraftSoon();
  drawOthers();
  const own = currentUser && currentUser.id === r.owner_id;
  toast(own ? 'Trasa otevřena – můžeš ji upravit a uložit změny.' : 'Trasa otevřena jako admin (patří uživateli ' + (r.owner_display || '?') + ').', 5000);
  return true;
}
document.getElementById('pl-gpx-file').addEventListener('change', async e=>{
  const f = e.target.files[0];
  e.target.value = '';
  if(!f) return;
  try{
    const { points, suggestedName, wptPoints } = parseGPX(await f.text());
    // v4.6: soubor s body (wpt) – spojit je po cestách; když má i trasu, zeptat se, co načíst
    const useWpt = wptPoints.length >= 2 && (!points.length ||
      confirm('Soubor obsahuje ' + wptPoints.length + ' bodů i nakreslenou trasu.\n\nOK = načíst body a spojit je po cestách (v pořadí ze souboru)\nZrušit = načíst nakreslenou trasu'));
    if(!confirmReplace('souborem ' + f.name)) return;
    closeSheet();
    const meta = { id:null, name: suggestedName || f.name.replace(/\.gpx$/i,''), description:'', route_type:'' };
    if(useWpt){
      loadWaypoints(wptPoints, meta);
      drawOthers();
      toast('Načteno ' + wptPoints.length + ' bodů – úseky mezi nimi se plánují po cestách (chvíli to potrvá).', 5000);
    } else {
      loadPoints(points, meta);
      drawOthers();
      toast('GPX načteno – body můžeš tahat, mazat a doplňovat.', 4000);
    }
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
    loadRouteList();
    // v4.13: po uložení plánovač začne novou trasu (uloženou jde vrátit tlačítkem ↶ Zpět)
    pushUndo();
    segs.forEach(sg=>sg.req++);
    wps = []; segs = []; editing = null;
    changed();
    dirty = false;
    try{ localStorage.removeItem(DRAFT_KEY); }catch(e){}
    drawOthers();
    toast((overwrite ? 'Změny trasy uloženy.' : 'Trasa uložena do CendurOFF.') + ' Můžeš kreslit novou trasu nebo otevřít GPX.', 4500);
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
  if(d.dirty === false){ try{ localStorage.removeItem(DRAFT_KEY); }catch(e){} return false; }
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
