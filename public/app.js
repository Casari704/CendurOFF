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
function pointsToGPX(points, name){
  const trkpts = points.map(p=>{
    const ele = p[2];
    const eleTag = (ele!=null && !isNaN(ele)) ? `<ele>${ele}</ele>` : '';
    return `<trkpt lat="${p[0]}" lon="${p[1]}">${eleTag}</trkpt>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n`+
    `<gpx version="1.1" creator="CendurOFF" xmlns="http://www.topografix.com/GPX/1/1">\n`+
    `<trk><name>${escapeHtml(name||'trasa')}</name><trkseg>${trkpts}</trkseg></trk>\n`+
    `</gpx>`;
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
  releaseWakeLock();
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
  map = L.map('map', { zoomControl:false }).setView([49.8967, 18.1969], 8);
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
    item.innerHTML = `
      <label class="visibility-toggle" title="Zobrazit/skrýt trasu na mapě">
        <input type="checkbox" class="route-visibility-checkbox" checked>
        <span class="visibility-box"></span>
      </label>
      <div class="route-item-info">
        <div class="r-name">${escapeHtml(route.name)}</div>
        <div class="r-meta">${escapeHtml(route.owner_display)} · ${Number(route.distance_km).toFixed(1)} km</div>
      </div>`;
    item.querySelector('.route-item-info').addEventListener('click', ()=>{
      const layer = layersById[route.id];
      if(layer){
        if(!map.hasLayer(layer)){
          layer.addTo(map);
          const cb = item.querySelector('.route-visibility-checkbox');
          if(cb) cb.checked = true;
        }
        map.fitBounds(layer.getBounds(), {maxZoom:14});
      }
      openDetail(route.id);
    });
    item.querySelector('.route-visibility-checkbox').addEventListener('change', (e)=>{
      const layer = layersById[route.id];
      if(!layer) return;
      if(e.target.checked) layer.addTo(map);
      else map.removeLayer(layer);
    });
    listEl.appendChild(item);
  });
}

const ROUTE_COLOR = '#FF0000';
const ROUTE_COLOR_SELECTED = '#1E64D6';
const ROUTE_COLOR_HOVER = '#7EB6FF'; // světlejší modrá než vybraná trasa - pro najetí myší

function drawRoute(route){
  const latlngs = route.points.map(p=>[p[0],p[1]]);
  const line = L.polyline(latlngs, { color:ROUTE_COLOR, weight:4, opacity:0.85 }).addTo(map);
  line.bindTooltip(`<b>${escapeHtml(route.name)}</b><br>${escapeHtml(route.owner_display)} · ${Number(route.distance_km).toFixed(1)} km`,
    { sticky:true, className:'trail-tip' });
  line.on('mouseover', ()=>{ if(route.id!==activeRouteId) line.setStyle({color:ROUTE_COLOR_HOVER, weight:6, opacity:1}); });
  line.on('mouseout', ()=>{ if(route.id!==activeRouteId) line.setStyle({color:ROUTE_COLOR, weight:4, opacity:0.85}); });
  line.on('click', ()=> openDetail(route.id));
  layersById[route.id] = line;
}

function highlightRoute(id){
  Object.entries(layersById).forEach(([rid, layer])=>{
    if(Number(rid)===Number(id)){
      layer.setStyle({ color: ROUTE_COLOR_SELECTED, weight:6, opacity:1 });
      layer.bringToFront();
    } else {
      layer.setStyle({ color: ROUTE_COLOR, weight:4, opacity:0.85 });
    }
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
    ${isOwner ? `
      <div class="edit-route-form" id="edit-route-form" style="display:none;">
        <label for="edit-route-name">Název trasy</label>
        <input type="text" id="edit-route-name" value="${escapeHtml(route.name)}">
        <label for="edit-route-desc">Popis</label>
        <textarea id="edit-route-desc">${escapeHtml(route.description||'')}</textarea>
        <div class="form-msg" id="edit-route-msg"></div>
        <div class="actions">
          <button class="ghost-btn" id="cancel-edit-route" type="button">Zrušit</button>
          <button class="primary-btn" id="save-edit-route" type="button" style="margin-top:0;">Uložit</button>
        </div>
      </div>` : ''}
    <div class="detail-stats">
      <div class="stat"><b>${Number(route.distance_km).toFixed(1)}</b><span>km</span></div>
      <div class="stat"><b>${Math.round(route.elev_gain_m)}</b><span>m převýšení</span></div>
      <div class="stat"><b>${route.points.length}</b><span>bodů GPX</span></div>
    </div>
    <button class="ghost-btn" id="download-gpx-btn" style="width:100%;margin-top:12px;">⬇ Stáhnout GPX</button>
    <div class="elev-profile">
      <h3>Výškový profil</h3>
      ${renderElevationProfile(route.points)}
    </div>
    ${route.description ? `<div class="detail-desc" id="detail-desc-text">${escapeHtml(route.description)}</div>` : ''}
    <div class="photo-grid">${photoSlots}</div>
    ${isOwner ? `
      <div class="owner-controls">
        <h3>Fotky trasy</h3>
        <p class="hint">Jako vlastník trasy můžete nahrát až 3 fotky a vybrat, která bude hlavní (max 3 MB na fotku).</p>
        <input type="file" id="photo-input" accept="image/*" ${photos.length>=3 ? 'disabled' : ''}>
        ${photos.length>=3 ? '<p class="hint">Všechny 3 sloty jsou obsazené.</p>' : ''}
        <button class="ghost-btn" id="edit-route-btn" style="width:100%;margin-top:14px;">Upravit trasu</button>
        <h3 style="margin-top:18px;">Nahradit GPX soubor</h3>
        <p class="hint">Nahrajte aktuálnější GPX - nahradí body, vzdálenost i převýšení současné trasy (název a popis zůstanou).</p>
        <input type="file" id="replace-gpx-input" accept=".gpx">
        <button class="danger-btn" id="delete-route-btn">Smazat trasu</button>
      </div>` : ''}
  `;

  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('download-gpx-btn').addEventListener('click', ()=> downloadGPX(route.points, route.name));

  if(isOwner){
    const editForm = document.getElementById('edit-route-form');
    const editBtn = document.getElementById('edit-route-btn');
    editBtn.addEventListener('click', ()=>{
      editForm.style.display = editForm.style.display==='none' ? 'block' : 'none';
      if(editForm.style.display==='block') editForm.scrollIntoView({ behavior:'smooth', block:'nearest' });
    });
    document.getElementById('cancel-edit-route').addEventListener('click', ()=>{
      editForm.style.display = 'none';
    });
    document.getElementById('save-edit-route').addEventListener('click', async ()=>{
      const msg = document.getElementById('edit-route-msg');
      const newName = document.getElementById('edit-route-name').value.trim();
      const newDesc = document.getElementById('edit-route-desc').value.trim();
      if(!newName){ msg.textContent = 'Zadejte název trasy.'; return; }
      msg.textContent = 'Ukládám…';
      try{
        await api(`/api/routes/${id}`, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name:newName, description:newDesc })
        });
        toast('Trasa byla upravena.');
        await loadRoutes();
        openDetail(id);
      }catch(e){ msg.textContent = e.message || 'Trasu se nepodařilo upravit.'; }
    });

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
    const replaceGpxInput = document.getElementById('replace-gpx-input');
    if(replaceGpxInput){
      replaceGpxInput.addEventListener('change', async ()=>{
        const file = replaceGpxInput.files[0];
        if(!file) return;
        if(!confirm('Nahradit aktuální trasu tímto GPX souborem? Body, vzdálenost a převýšení se přepíší.')){
          replaceGpxInput.value = '';
          return;
        }
        try{
          const text = await file.text();
          const { points } = parseGPX(text);
          await api(`/api/routes/${id}`, {
            method:'PATCH',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ name: route.name, description: route.description || '', points })
          });
          toast('GPX soubor byl nahrazen.');
          await loadRoutes();
          openDetail(id);
        }catch(e){
          toast(e.message || 'GPX soubor se nepodařilo nahradit.');
        }finally{
          replaceGpxInput.value = '';
        }
      });
    }
  }
}

function closeDetail(){
  document.getElementById('detail-panel').classList.remove('open');
  activeRouteId = null;
  Object.values(layersById).forEach(l=>l.setStyle({color:ROUTE_COLOR, weight:4, opacity:0.85}));
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
let followMode=false, headingMode='north', lastLatLng=null, orientationBound=false;

// --- Nastavení směrové navigace (naladěno pro motorku / pomalé technické pasáže) ---
const HEADING_SPEED_THRESHOLD_KMH = 5;     // nad touto rychlostí bereme směr z GPS kurzu, pod ní z kompasu telefonu
const HEADING_FILTER_ALPHA_GPS = 0.35;     // vyhlazení GPS kurzu (0-1, vyšší = pružnější reakce)
const HEADING_FILTER_ALPHA_COMPASS = 0.12; // vyhlazení kompasu (nižší = silnější filtr proti "cukání" na motorce)
const HEADING_UPDATE_THRESHOLD_DEG = 4;    // změny menší než tento úhel se ignorují (potlačení chvění mapy)
const HEADING_MIN_UPDATE_MS = 120;         // natočení mapy se přepočítá nejvýš cca 8x za sekundu
const MAP_HEADING_SCALE = 1.6;             // zvětšení mapy v režimu "směr jízdy" (kryje okraje při rotaci)

let smoothedHeading = 0;      // úhel po nízkopásmovém filtru
let displayedHeading = 0;     // úhel skutečně vykreslený (po prahování/limitu reakce)
let headingInitialized = false;
let lastHeadingUpdateTs = 0;
let currentSpeedKmh = 0;

const locateBtn = document.getElementById('locate-btn');
const headingBtn = document.getElementById('heading-btn');
const locateBtnLabel = document.getElementById('locate-btn-label');
const headingBtnLabel = document.getElementById('heading-btn-label');
const mapEl = document.getElementById('map');

document.getElementById('zoom-in-btn').addEventListener('click', ()=> map.zoomIn());
document.getElementById('zoom-out-btn').addEventListener('click', ()=> map.zoomOut());

function ensureGpsMarker(latlng, accuracy){
  if(!gpsMarker){
    const icon = L.divIcon({
      className:'gps-marker-icon',
      html:`<div class="gps-heading-icon" id="gps-arrow"><img src="public/img/gps-arrow.png" alt="Směr"></div>`,
      iconSize:[34,34], iconAnchor:[17,17]
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

// Rozdíl dvou úhlů v rozsahu -180..180 (ošetřuje přechod přes 0°/360°)
function angleDiff(a, b){
  return ((a - b + 540) % 360) - 180;
}

// Nízkopásmový (exponenciální) filtr úhlu, počítá se přes nejkratší rozdíl
function smoothAngle(prev, target, alpha){
  return (prev + alpha * angleDiff(target, prev) + 360) % 360;
}

// Zpracuje nový "syrový" úhel (z GPS kurzu nebo kompasu): vyfiltruje ho a na mapu/šipku
// ho promítne jen tehdy, když se změnil o víc než HEADING_UPDATE_THRESHOLD_DEG a zároveň
// uplynul minimální čas od poslední aktualizace - to potlačuje chvění mapy.
function feedHeading(rawDeg, alpha){
  if(rawDeg==null || isNaN(rawDeg)) return;
  if(!headingInitialized){
    smoothedHeading = rawDeg;
    displayedHeading = rawDeg;
    headingInitialized = true;
  } else {
    smoothedHeading = smoothAngle(smoothedHeading, rawDeg, alpha);
  }
  const now = performance.now();
  const change = Math.abs(angleDiff(smoothedHeading, displayedHeading));
  if(change >= HEADING_UPDATE_THRESHOLD_DEG && (now - lastHeadingUpdateTs) >= HEADING_MIN_UPDATE_MS){
    displayedHeading = smoothedHeading;
    lastHeadingUpdateTs = now;
    if(headingMode==='heading') setMapRotation(true); else updateArrowRotation(displayedHeading);
  }
}

function onPosition(pos){
  const latlng = [pos.coords.latitude, pos.coords.longitude];
  lastLatLng = latlng;
  ensureGpsMarker(latlng, pos.coords.accuracy);

  // rychlost v km/h (GPS coords.speed je v m/s); chybějící/neplatnou hodnotu bereme jako 0
  currentSpeedKmh = (pos.coords.speed != null && !isNaN(pos.coords.speed)) ? pos.coords.speed * 3.6 : 0;

  // Nad prahovou rychlostí bereme směr z GPS kurzu (na motorce za jízdy stabilnější než kompas).
  // Pod prahem (stání, pomalá technická pasáž) je GPS kurz nespolehlivý - směr pak dodává kompas
  // telefonu (viz startOrientation), pokud je uživatel zapnul.
  if(currentSpeedKmh > HEADING_SPEED_THRESHOLD_KMH && pos.coords.heading != null && !isNaN(pos.coords.heading)){
    feedHeading(pos.coords.heading, HEADING_FILTER_ALPHA_GPS);
  }

  if(followMode) map.setView(latlng, map.getZoom(), { animate:true });
}
function onPositionError(err){
  toast('Polohu se nepodařilo získat: ' + (err.message || 'neznámá chyba'));
  followMode = false;
  locateBtn.classList.remove('active');
  locateBtnLabel.textContent = 'Nesleduji polohu';
}

locateBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){ toast('Prohlížeč nepodporuje GPS polohu.'); return; }
  if(watchId==null){
    followMode = true;
    locateBtn.classList.add('active');
    locateBtnLabel.textContent = 'Sleduji polohu';
    headingBtn.disabled = false;
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy:true, maximumAge:2000, timeout:15000 });
  } else if(!followMode){
    followMode = true;
    locateBtn.classList.add('active');
    locateBtnLabel.textContent = 'Sleduji polohu';
    if(lastLatLng) map.setView(lastLatLng, map.getZoom());
  } else {
    followMode = false;
    locateBtn.classList.remove('active');
    locateBtnLabel.textContent = 'Nesleduji polohu';
  }
});

function startOrientation(){
  if(orientationBound) return;
  orientationBound = true;
  const handler = (e)=>{
    // Kompas telefonu bereme v potaz jen pod rychlostním prahem - nad ním má
    // přednost GPS kurz, který se zpracovává v onPosition().
    if(currentSpeedKmh > HEADING_SPEED_THRESHOLD_KMH) return;
    let heading = null;
    if(e.webkitCompassHeading != null) heading = e.webkitCompassHeading;
    else if(e.alpha != null) heading = 360 - e.alpha;
    if(heading==null || isNaN(heading)) return;
    feedHeading(heading, HEADING_FILTER_ALPHA_COMPASS);
  };
  window.addEventListener('deviceorientationabsolute', handler, true);
  window.addEventListener('deviceorientation', handler, true);
}

function setMapRotation(on){
  if(on){
    mapEl.style.transform = 'scale(' + MAP_HEADING_SCALE + ') rotate(' + (-displayedHeading) + 'deg)';
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    updateArrowRotation(0);
  } else {
    mapEl.style.transform = 'none';
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    updateArrowRotation(displayedHeading);
  }
}

headingBtn.addEventListener('click', async ()=>{
  if(headingMode==='north'){
    // Kompas je jen doplněk pro nízké rychlosti (viz startOrientation) - pokud
    // není dostupný / nepovolený (typicky PC bez kompasu), režim "směr jízdy"
    // se přesto zapne a nad 5 km/h normálně jede podle GPS kurzu.
    if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      try{
        const perm = await DeviceOrientationEvent.requestPermission();
        if(perm === 'granted') startOrientation();
        else toast('Kompas nedostupný - pod 5 km/h bude směr méně přesný, nad 5 km/h se použije GPS kurz.');
      }catch(e){ /* kompas na tomto zařízení není - GPS kurz nad 5 km/h funguje bez něj */ }
    } else {
      startOrientation();
    }
    headingMode = 'heading';
    headingBtn.classList.add('active');
    headingBtnLabel.textContent = 'Směr jízdy';
    setMapRotation(true);
  } else {
    headingMode = 'north';
    headingBtn.classList.remove('active');
    headingBtnLabel.textContent = 'Sever nahoru';
    setMapRotation(false);
  }
});

// ---------------------------------------------------------------
// Wake Lock - zabránění zhasnutí/vypnutí displeje během používání
// ---------------------------------------------------------------
let wakeLock = null;
async function requestWakeLock(){
  if(!('wakeLock' in navigator)) return;
  try{
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', ()=>{ wakeLock = null; });
  }catch(e){ /* zařízení/prohlížeč to nepodporuje nebo je málo baterie - v pořádku, tiše ignorujeme */ }
}
function releaseWakeLock(){
  if(wakeLock){ wakeLock.release(); wakeLock = null; }
}
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible' && currentUser) requestWakeLock();
});

// ---------------------------------------------------------------
// Celá obrazovka (schová adresní řádek prohlížeče)
// ---------------------------------------------------------------
const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('click', async ()=>{
  try{
    if(!document.fullscreenElement){
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }catch(e){ toast('Celou obrazovku se nepodařilo přepnout.'); }
});
document.addEventListener('fullscreenchange', ()=>{
  fullscreenBtn.classList.toggle('active', !!document.fullscreenElement);
  fullscreenBtn.title = document.fullscreenElement ? 'Ukončit celou obrazovku' : 'Celá obrazovka';
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
  requestWakeLock();
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
