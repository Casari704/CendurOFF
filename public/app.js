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

async function api(url, options){
  const res = await fetch(url, Object.assign({ credentials:'include' }, options));
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

function initMap(){
  if(map) return;
  map = L.map('map', { zoomControl:true }).setView([49.8967, 18.1969], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> přispěvatelé'
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
  const line = L.polyline(latlngs, { color, weight:4, opacity:0.85 }).addTo(map);
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
    ${route.description ? `<div class="detail-desc">${escapeHtml(route.description)}</div>` : ''}
    <div class="photo-grid">${photoSlots}</div>
    ${isOwner ? `
      <div class="owner-controls">
        <h3>Fotky trasy</h3>
        <p class="hint">Jako vlastník trasy můžete nahrát až 3 fotky a vybrat, která bude hlavní (max 3 MB na fotku).</p>
        <input type="file" id="photo-input" accept="image/*" ${photos.length>=3 ? 'disabled' : ''}>
        ${photos.length>=3 ? '<p class="hint">Všechny 3 sloty jsou obsazené.</p>' : ''}
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
