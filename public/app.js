(function(){

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>{ t.style.display='none'; }, 3200);
}
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
    if(d>0) gain += d;
  }
  return { distanceKm: dist/1000, elevGainM: gain };
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
    return [lat, lon, ele];
  }).filter(p=>!isNaN(p[0]) && !isNaN(p[1]));
  const nameEl = doc.getElementsByTagName('name')[0];
  return { points, suggestedName: nameEl ? nameEl.textContent.trim() : '' };
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString('cs-CZ',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return ''; } }


 // Vlož tvou URL adresu z Railway bez lomítka na konci
const API_URL = 'https://cenduroff-web.up.railway.app';

async function api(url, options){
  // Automaticky připojí adresu backendu z Railway ke všem voláním
  const fullUrl = url.startsWith('http') ? url : API_URL + url;
  const res = await fetch(fullUrl, Object.assign({ credentials:'include' }, options));
  let data = null;
  try{ data = await res.json(); }catch(e){}
  if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
  return data;
}

  
const PALETTE = ['#A8572E','#4F7048','#2F5D62','#8A5FA6','#B08A2E','#3C5E8A'];
function colorFor(id){
  const s = String(id);
  let h=0; for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
let currentUser = null; // {id, username, displayName}
let mode = 'login';

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginSubmit = document.getElementById('login-submit');
const formMsg = document.getElementById('form-msg');
const loginForm = document.getElementById('login-form');

tabLogin.addEventListener('click', ()=>{
  mode='login'; tabLogin.classList.add('active'); tabRegister.classList.remove('active');
  loginSubmit.textContent='Přihlásit se'; formMsg.textContent='';
});
tabRegister.addEventListener('click', ()=>{
  mode='register'; tabRegister.classList.add('active'); tabLogin.classList.remove('active');
  loginSubmit.textContent='Vytvořit účet'; formMsg.textContent='';
});

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const usernameRaw = document.getElementById('li-user').value.trim();
  const username = usernameRaw.toLowerCase();
  const pass = document.getElementById('li-pass').value;
  if(!username || !pass){ formMsg.textContent='Vyplňte jméno i heslo.'; return; }
  formMsg.textContent='';
  formMsg.style.color='';
  loginSubmit.disabled = true;
  try{
    const endpoint = mode==='register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode==='register'
      ? { username, password: pass, displayName: usernameRaw }
      : { username, password: pass };
    const user = await api(endpoint, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if(mode==='register' && user.approved===false){
      formMsg.style.color = 'var(--moss-dark)';
      formMsg.textContent = user.message || 'Registrace přijata, počkej na schválení administrátorem.';
      loginSubmit.disabled = false;
      return;
    }
    currentUser = user;
    enterApp();
  }catch(err){
    formMsg.textContent = err.message || 'Něco se nepovedlo, zkuste to prosím znovu.';
  }finally{
    loginSubmit.disabled = false;
  }
});

document.getElementById('logout-btn').addEventListener('click', async ()=>{
  try{ await api('/api/auth/logout', { method:'POST' }); }catch(e){}
  currentUser = null;
  document.getElementById('app-screen').style.display='none';
  document.getElementById('login-screen').style.display='flex';
});

// ---------------------------------------------------------------
// Map + routes
// ---------------------------------------------------------------
let map, activeRouteId=null;
const layersById = {};
let routesCache = {};

// sbalitelný seznam tras
const routeListEl = document.getElementById('route-list');
const routeListToggle = document.getElementById('route-list-toggle');
if(localStorage.getItem('routeListCollapsed') === '1') routeListEl.classList.add('collapsed');
routeListToggle.addEventListener('click', ()=>{
  routeListEl.classList.toggle('collapsed');
  localStorage.setItem('routeListCollapsed', routeListEl.classList.contains('collapsed') ? '1' : '0');
});

// modal "O projektu"
const aboutOverlay = document.getElementById('about-overlay');
document.getElementById('open-about').addEventListener('click', ()=> aboutOverlay.classList.add('open'));
document.getElementById('about-close').addEventListener('click', ()=> aboutOverlay.classList.remove('open'));
aboutOverlay.addEventListener('click', (e)=>{ if(e.target===aboutOverlay) aboutOverlay.classList.remove('open'); });

function initMap(){
  if(map) return;
  map = L.map('map', { zoomControl:true }).setView([49.8967, 18.1969], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors, CyclOSM'
  }).addTo(map);
}

async function loadRoutes(){
  const listEl = document.getElementById('route-items');
  const countEl = document.getElementById('route-count');
  let routes = [];
  try{
    routes = await api('/api/routes');
  }catch(e){
    listEl.innerHTML = '<div class="empty-note">Trasy se nepodařilo načíst ze serveru.</div>';
    return;
  }
  if(routes.length===0){
    listEl.innerHTML = '<div class="empty-note">Zatím tu nejsou žádné trasy. Buďte první, kdo nějakou nahraje.</div>';
    countEl.textContent='';
  }
  routesCache = {};
  Object.values(layersById).forEach(l=>map.removeLayer(l));
  for(const k in layersById) delete layersById[k];
  listEl.innerHTML='';
  countEl.textContent = routes.length ? '('+routes.length+')' : '';
  routes.forEach(route=>{
    routesCache[route.id] = route;
    drawRoute(route);
    const item = document.createElement('div');
    item.className='route-item';
    item.innerHTML = `<div class="r-name">${escapeHtml(route.name)}</div>
      <div class="r-meta">${escapeHtml(route.owner_display)} · ${Number(route.distance_km).toFixed(1)} km</div>`;
    item.addEventListener('click', ()=>{
      const layer = layersById[route.id];
      if(layer) map.fitBounds(layer.getBounds(), {maxZoom:14});
      openDetail(route.id);
    });
    listEl.appendChild(item);
  });
}

function drawRoute(route){
  const latlngs = route.points.map(p=>[p[0],p[1]]);
  const color = colorFor(route.id);
  const line = L.polyline(latlngs, { color:'#FF0000', weight:4, opacity:0.85 }).addTo(map);
  line.bindTooltip(`<b>${escapeHtml(route.name)}</b><br>${escapeHtml(route.owner_display)} · ${Number(route.distance_km).toFixed(1)} km`,
    { sticky:true, className:'trail-tip' });
  line.on('mouseover', ()=>{ if(route.id!==activeRouteId) line.setStyle({weight:6, opacity:1}); });
  line.on('mouseout', ()=>{ if(route.id!==activeRouteId) line.setStyle({weight:4, opacity:0.85}); });
  line.on('click', ()=> openDetail(route.id));
  layersById[route.id] = line;
}

function highlightRoute(id){
  Object.entries(layersById).forEach(([rid, layer])=>{
    if(Number(rid)===Number(id)) layer.setStyle({ weight:6, opacity:1 });
    else layer.setStyle({ weight:4, opacity:0.85 });
  });
}

// ---------------------------------------------------------------
// Výškový profil
// ---------------------------------------------------------------
function renderElevationProfile(points){
  const hasEle = points.some(p => p[2] != null && !isNaN(p[2]));
  if(!hasEle) return '<p class="elev-note">Trasa neobsahuje data o nadmořské výšce.</p>';
  let dist = 0;
  const series = [[0, points[0][2] ?? 0]];
  for(let i=1;i<points.length;i++){
    dist += haversine(points[i-1], points[i]);
    const ele = points[i][2];
    if(ele != null && !isNaN(ele)) series.push([dist/1000, ele]);
  }
  if(series.length < 2) return '<p class="elev-note">Trasa neobsahuje data o nadmořské výšce.</p>';
  const eles = series.map(p=>p[1]);
  const minEle = Math.min(...eles), maxEle = Math.max(...eles);
  const maxDist = series[series.length-1][0] || 1;
  const W=300, H=90, PAD=4;
  const scaleX = d => PAD + (d/maxDist) * (W-2*PAD);
  const scaleY = e => H-PAD - ((e-minEle)/((maxEle-minEle)||1)) * (H-2*PAD);
  const pathD = series.map((p,i)=> (i===0?'M':'L') + scaleX(p[0]).toFixed(1) + ',' + scaleY(p[1]).toFixed(1)).join(' ');
  const areaD = pathD + ` L${scaleX(series[series.length-1][0]).toFixed(1)},${H-PAD} L${scaleX(0).toFixed(1)},${H-PAD} Z`;
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${areaD}" fill="#4F7048" fill-opacity="0.18" stroke="none"></path>
      <path d="${pathD}" fill="none" stroke="#4F7048" stroke-width="2"></path>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--ink-soft);margin-top:4px;">
      <span>${Math.round(minEle)} m</span><span>${Math.round(maxEle)} m</span>
    </div>`;
}

// ---------------------------------------------------------------
// Detail panel + photos
// ---------------------------------------------------------------
async function openDetail(id){
  activeRouteId = id;
  highlightRoute(id);
  const panel = document.getElementById('detail-panel');
  const inner = document.getElementById('detail-inner');
  inner.innerHTML = '<div class="empty-note">Načítání…</div>';
  panel.classList.add('open');

  let route, photos = [];
  try{
    const data = await api('/api/routes/'+id);
    route = data.route;
    photos = data.photos;
  }catch(e){
    inner.innerHTML = '<button class="detail-close" id="detail-close">×</button><div class="empty-note">Trasu se nepodařilo načíst.</div>';
    document.getElementById('detail-close').addEventListener('click', closeDetail);
    return;
  }

  const isOwner = currentUser && currentUser.id === route.owner_id;

  const photoSlots = [0,1,2].map(i=>{
    const p = photos[i];
    if(!p){
      return `<div class="photo-slot"><span class="empty-plus">·</span></div>`;
    }
    return `<div class="photo-slot">
        <img src="${p.data_url}" alt="Fotka trasy ${escapeHtml(route.name)}">
        ${p.is_main ? '<span class="main-badge">HLAVNÍ</span>' : ''}
        ${isOwner ? `<button class="delete-photo-btn" data-photo="${p.id}" title="Smazat fotku">×</button>` : ''}
        ${isOwner && !p.is_main ? `<button class="set-main-btn" data-photo="${p.id}">Nastavit jako hlavní</button>` : ''}
      </div>`;
  }).join('');

  inner.innerHTML = `
    <button class="detail-close" id="detail-close">×</button>
    <h2>${escapeHtml(route.name)}</h2>
    <div class="detail-owner">Přidal(a) ${escapeHtml(route.owner_display)} · ${fmtDate(route.created_at)}</div>
    <div class="detail-stats">
      <div class="stat"><b>${Number(route.distance_km).toFixed(1)}</b><span>km</span></div>
      <div class="stat"><b>${Math.round(route.elev_gain_m)}</b><span>m převýšení</span></div>
      <div class="stat"><b>${route.points.length}</b><span>bodů GPX</span></div>
    </div>
    <div class="elev-profile">
      <h3>Výškový profil</h3>
      ${renderElevationProfile(route.points)}
    </div>
    ${route.description ? `<div class="detail-desc">${escapeHtml(route.description)}</div>` : ''}
    <div class="photo-grid">${photoSlots}</div>
    ${isOwner ? `
      <div class="owner-controls">
        <h3>Fotky trasy</h3>
        <p class="hint">Jako vlastník trasy můžete nahrát až 3 fotky a vybrat, která bude hlavní (max 3 MB na fotku).</p>
        <input type="file" id="photo-input" accept="image/*" ${photos.length>=3 ? 'disabled' : ''}>
        ${photos.length>=3 ? '<p class="hint">Všechny 3 sloty jsou obsazené.</p>' : ''}
        <button class="danger-btn" id="delete-route-btn">Smazat trasu</button>
      </div>` : ''}
  `;

  document.getElementById('detail-close').addEventListener('click', closeDetail);

  if(isOwner){
    inner.querySelectorAll('.set-main-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        try{
          await api(`/api/routes/${id}/photos/${btn.dataset.photo}/main`, { method:'PATCH' });
          toast('Hlavní fotka nastavena.');
          openDetail(id);
        }catch(e){ toast(e.message || 'Nepodařilo se uložit změnu.'); }
      });
    });
    inner.querySelectorAll('.delete-photo-btn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        if(!confirm('Smazat tuto fotku?')) return;
        try{
          await api(`/api/routes/${id}/photos/${btn.dataset.photo}`, { method:'DELETE' });
          toast('Fotka smazána.');
          openDetail(id);
        }catch(e){ toast(e.message || 'Fotku se nepodařilo smazat.'); }
      });
    });
    const deleteRouteBtn = document.getElementById('delete-route-btn');
    if(deleteRouteBtn){
      deleteRouteBtn.addEventListener('click', async ()=>{
        if(!confirm('Opravdu chceš trasu "'+route.name+'" natrvalo smazat? Tuto akci nejde vrátit zpět.')) return;
        try{
          await api(`/api/routes/${id}`, { method:'DELETE' });
          toast('Trasa byla smazána.');
          closeDetail();
          await loadRoutes();
        }catch(e){ toast(e.message || 'Trasu se nepodařilo smazat.'); }
      });
    }
    const photoInput = document.getElementById('photo-input');
    if(photoInput){
      photoInput.addEventListener('change', async ()=>{
        const file = photoInput.files[0];
        if(!file) return;
        if(file.size > 3*1024*1024){ toast('Obrázek je příliš velký (max 3 MB).'); return; }
        try{
          const fd = new FormData();
          fd.append('photo', file);
          await api(`/api/routes/${id}/photos`, { method:'POST', body: fd });
          toast('Fotka přidána.');
          openDetail(id);
        }catch(e){ toast(e.message || 'Nahrání fotky se nepovedlo.'); }
      });
    }
  }
}

function closeDetail(){
  document.getElementById('detail-panel').classList.remove('open');
  activeRouteId = null;
  Object.values(layersById).forEach(l=>l.setStyle({weight:4, opacity:0.85}));
}

// ---------------------------------------------------------------
// Upload modal
// ---------------------------------------------------------------
const overlay = document.getElementById('upload-overlay');
document.getElementById('open-upload').addEventListener('click', ()=>{
  document.getElementById('gpx-file').value='';
  document.getElementById('route-name').value='';
  document.getElementById('route-desc').value='';
  document.getElementById('upload-msg').textContent='';
  overlay.classList.add('open');
});
document.getElementById('cancel-upload').addEventListener('click', ()=> overlay.classList.remove('open'));

let pendingPoints = null;

document.getElementById('gpx-file').addEventListener('change', async ()=>{
  const file = document.getElementById('gpx-file').files[0];
  pendingPoints = null;
  if(!file) return;
  try{
    const text = await file.text();
    const { points, suggestedName } = parseGPX(text);
    pendingPoints = points;
    const nameField = document.getElementById('route-name');
    if(!nameField.value && suggestedName) nameField.value = suggestedName;
    else if(!nameField.value) nameField.value = file.name.replace(/\.gpx$/i,'');
  }catch(e){
    document.getElementById('upload-msg').textContent = e.message;
  }
});

document.getElementById('confirm-upload').addEventListener('click', async ()=>{
  const msg = document.getElementById('upload-msg');
  const fileInput = document.getElementById('gpx-file');
  const name = document.getElementById('route-name').value.trim();
  const desc = document.getElementById('route-desc').value.trim();
  if(!fileInput.files[0]){ msg.textContent='Vyberte GPX soubor.'; return; }
  if(!name){ msg.textContent='Zadejte název trasy.'; return; }
  if(!pendingPoints){ msg.textContent='GPX soubor se ještě nepodařilo přečíst, zkuste ho vybrat znovu.'; return; }
  msg.textContent='Nahrávám…';
  try{
    const route = await api('/api/routes', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, description: desc, points: pendingPoints })
    });
    overlay.classList.remove('open');
    toast('Trasa byla nahrána.');
    await loadRoutes();
    const layer = layersById[route.id];
    if(layer) map.fitBounds(layer.getBounds(), {maxZoom:14});
    openDetail(route.id);
  }catch(e){
    msg.textContent = e.message || 'Soubor se nepodařilo zpracovat.';
  }
});

// ---------------------------------------------------------------
// GPS poloha, sledování a kompas
// ---------------------------------------------------------------
let gpsMarker=null, gpsAccuracyCircle=null, watchId=null;
let followMode=false, headingMode='north', currentHeading=0, lastLatLng=null, orientationBound=false;

const locateBtn = document.getElementById('locate-btn');
const headingBtn = document.getElementById('heading-btn');
const mapEl = document.getElementById('map');

function arrowSvg(){
  return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4F7048" stroke="#fff" stroke-width="2"/><path d="M12 5 L16 14 L12 12 L8 14 Z" fill="#fff"/></svg>';
}
function ensureGpsMarker(latlng, accuracy){
  if(!gpsMarker){
    const icon = L.divIcon({
      className:'gps-marker-icon', html:`<div class="gps-heading-icon" id="gps-arrow">${arrowSvg()}</div>`,
      iconSize:[26,26], iconAnchor:[13,13]
    });
    gpsMarker = L.marker(latlng, { icon, zIndexOffset:1000 }).addTo(map);
    gpsAccuracyCircle = L.circle(latlng, { radius:accuracy||20, color:'#4F7048', fillColor:'#4F7048', fillOpacity:0.15, weight:1 }).addTo(map);
  } else {
    gpsMarker.setLatLng(latlng);
    gpsAccuracyCircle.setLatLng(latlng);
    gpsAccuracyCircle.setRadius(accuracy||20);
  }
}
function updateArrowRotation(deg){
  const el = document.getElementById('gps-arrow');
  if(el) el.style.transform = 'rotate('+deg+'deg)';
}

function onPosition(pos){
  const latlng = [pos.coords.latitude, pos.coords.longitude];
  lastLatLng = latlng;
  ensureGpsMarker(latlng, pos.coords.accuracy);
  if(pos.coords.heading != null && !isNaN(pos.coords.heading)){
    currentHeading = pos.coords.heading;
    if(headingMode==='heading') setMapRotation(true); else updateArrowRotation(currentHeading);
  }
  if(followMode) map.setView(latlng, map.getZoom(), { animate:true });
}
function onPositionError(err){
  toast('Polohu se nepodařilo získat: ' + (err.message || 'neznámá chyba'));
  followMode = false;
  locateBtn.classList.remove('active');
}

locateBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){ toast('Prohlížeč nepodporuje GPS polohu.'); return; }
  if(watchId==null){
    followMode = true;
    locateBtn.classList.add('active');
    headingBtn.disabled = false;
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy:true, maximumAge:2000, timeout:15000 });
  } else if(!followMode){
    followMode = true;
    locateBtn.classList.add('active');
    if(lastLatLng) map.setView(lastLatLng, map.getZoom());
  } else {
    followMode = false;
    locateBtn.classList.remove('active');
  }
});

function startOrientation(){
  if(orientationBound) return;
  orientationBound = true;
  const handler = (e)=>{
    let heading = null;
    if(e.webkitCompassHeading != null) heading = e.webkitCompassHeading;
    else if(e.alpha != null) heading = 360 - e.alpha;
    if(heading==null || isNaN(heading)) return;
    currentHeading = heading;
    if(headingMode==='heading') setMapRotation(true); else updateArrowRotation(heading);
  };
  window.addEventListener('deviceorientationabsolute', handler, true);
  window.addEventListener('deviceorientation', handler, true);
}

function setMapRotation(on){
  if(on){
    mapEl.style.transform = 'scale(1.6) rotate(' + (-currentHeading) + 'deg)';
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    updateArrowRotation(0);
  } else {
    mapEl.style.transform = 'none';
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
  }
}

headingBtn.addEventListener('click', async ()=>{
  if(headingMode==='north'){
    if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      try{
        const perm = await DeviceOrientationEvent.requestPermission();
        if(perm !== 'granted'){ toast('Přístup ke kompasu nebyl povolen.'); return; }
      }catch(e){ toast('Kompas není na tomto zařízení dostupný.'); return; }
    }
    startOrientation();
    headingMode = 'heading';
    headingBtn.classList.add('active');
    setMapRotation(true);
  } else {
    headingMode = 'north';
    headingBtn.classList.remove('active');
    setMapRotation(false);
  }
});

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
async function enterApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-screen').style.display='flex';
  document.getElementById('user-chip').textContent = currentUser.displayName;
  initMap();
  setTimeout(()=>map.invalidateSize(), 50);
  await loadRoutes();
}

(async function boot(){
  try{
    const user = await api('/api/auth/me');
    currentUser = user;
    enterApp();
  }catch(e){
    // not logged in - show login screen (already visible by default)
  }
})();

})();
