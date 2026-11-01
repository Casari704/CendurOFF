(function(){

// ---------------------------------------------------------------
// Pojistka: prvky, které novější funkce potřebují v index.html. Kdyby na webu
// zůstal starší index.html (leží mimo složku public/, snadno se přehlédne),
// skript si je doplní sám, aby kvůli tomu nepřestal fungovat.
// ---------------------------------------------------------------
(function ensureMarkup(){
  if(!document.getElementById('route-tools')){
    const items = document.getElementById('route-items');
    if(items) items.insertAdjacentHTML('beforebegin',
      `<div id="route-tools"><button class="ghost-btn" id="select-mode-btn" type="button">Stáhnout více tras</button></div>`);
  }
  if(!document.getElementById('selection-bar')){
    const list = document.getElementById('route-list');
    if(list) list.insertAdjacentHTML('afterend', `
      <div id="selection-bar">
        <span id="selection-count"></span>
        <div class="selection-actions">
          <button class="primary-btn" id="selection-download" type="button">⬇ Stáhnout GPX</button>
          <button class="ghost-btn" id="selection-cancel" type="button">Zrušit</button>
        </div>
      </div>`);
  }
  if(!document.getElementById('route-type')){
    const desc = document.getElementById('route-desc');
    if(desc) desc.insertAdjacentHTML('afterend', `
      <label for="route-type">Typ trasy</label>
      <select id="route-type">
        <option value="">— vyberte typ trasy —</option>
        <option value="transport">Transportní</option><option value="cenduro">Cenduro</option><option value="offroad">Offroad</option>
      </select>`);
  }
  if(!document.getElementById('route-legend')){
    const tools = document.getElementById('route-tools');
    if(tools) tools.insertAdjacentHTML('beforeend', `<div id="route-legend"></div>`);
  }
  if(!document.getElementById('route-list-tab')){
    const list = document.getElementById('route-list');
    if(list) list.insertAdjacentHTML('afterbegin',
      `<button class="panel-tab" id="route-list-tab" type="button" title="Skrýt/zobrazit seznam tras" aria-label="Skrýt/zobrazit seznam tras"><span class="tab-arrow">‹</span></button>`);
  }
  if(!document.getElementById('detail-panel-tab')){
    const panel = document.getElementById('detail-panel');
    if(panel) panel.insertAdjacentHTML('afterbegin',
      `<button class="panel-tab" id="detail-panel-tab" type="button" title="Zavřít detail trasy" aria-label="Zavřít detail trasy"><span class="tab-arrow">‹</span></button>`);
  }
  // záznam jízdy + odkaz na plánovač (verze 1.27)
  if(!document.getElementById('open-planner')){
    const up = document.getElementById('open-upload');
    if(up) up.insertAdjacentHTML('afterend', `<a class="btn" id="open-planner" href="planovac.html">✏️ Plánovač</a>`);
  }
  if(!document.getElementById('rec-btn')){
    const lc = document.getElementById('locate-controls');
    if(lc) lc.insertAdjacentHTML('afterbegin', `
      <button class="map-btn rec-btn" id="rec-btn" type="button" title="Nahrávat projetou trasu">
        <span class="map-btn-icon"><span class="rec-icon"></span></span>
        <span class="map-btn-label" id="rec-btn-label">Záznam jízdy</span>
      </button>`);
  }
  if(!document.getElementById('rec-panel')){
    const dp = document.getElementById('detail-panel');
    if(dp) dp.insertAdjacentHTML('beforebegin', `
      <div id="rec-panel">
        <div class="rec-status"><span class="rec-dot"></span><span id="rec-state">Nahrávám</span></div>
        <div class="rec-stats">
          <div><b id="rec-time">0:00:00</b><span>čas</span></div>
          <div><b id="rec-dist">0,0</b><span>km</span></div>
          <div><b id="rec-speed">–</b><span>km/h</span></div>
        </div>
        <div class="rec-actions">
          <button class="ghost-btn" id="rec-pause" type="button">Pauza</button>
          <button class="primary-btn" id="rec-stop" type="button">Stop</button>
        </div>
      </div>`);
  }
  if(!document.getElementById('ride-overlay')){
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="ride-overlay">
        <div class="modal ride-modal">
          <h2>Záznam jízdy</h2>
          <div class="detail-stats ride-stats">
            <div class="stat"><b id="ride-dist">0</b><span>km</span></div>
            <div class="stat"><b id="ride-time">0:00</b><span>čas jízdy</span></div>
            <div class="stat"><b id="ride-gain">0</b><span>m převýšení</span></div>
          </div>
          <label for="ride-name">Název trasy</label>
          <input type="text" id="ride-name">
          <label for="ride-desc">Popis (nepovinné)</label>
          <textarea id="ride-desc" placeholder="Pár slov o trase, terénu, náročnosti…"></textarea>
          <label for="ride-type">Typ trasy</label>
          <select id="ride-type">
            <option value="">— vyberte typ trasy —</option>
            <option value="transport">Transportní</option><option value="cenduro">Cenduro</option><option value="offroad">Offroad</option>
          </select>
          <div class="form-msg" id="ride-msg"></div>
          <button class="primary-btn" id="ride-save" type="button">Uložit do CendurOFF</button>
          <div class="ride-row">
            <button class="ghost-btn" id="ride-download" type="button">⬇ Stáhnout GPX</button>
            <button class="ghost-btn" id="ride-planner" type="button">✏️ Upravit v plánovači</button>
          </div>
          <div class="ride-row">
            <button class="ghost-btn" id="ride-resume" type="button">Pokračovat v záznamu</button>
            <button class="ghost-btn ride-discard" id="ride-discard" type="button">Zahodit záznam</button>
          </div>
        </div>
      </div>`);
  }
  // benzínky + název stránky u loga (verze 1.28)
  if(!document.getElementById('fuel-btn')){
    const sat = document.getElementById('satellite-btn');
    if(sat) sat.insertAdjacentHTML('beforebegin', `<button class="map-btn map-btn-square" id="fuel-btn" title="Zobrazit / skrýt čerpací stanice">⛽</button>`);
  }
  const brandEl = document.querySelector('header.topbar .brand');
  if(brandEl && !brandEl.querySelector('.brand-sub')) brandEl.insertAdjacentHTML('beforeend', ` <span class="brand-sub">Atlas</span>`);
  if(!document.getElementById('lightbox')){
    document.body.insertAdjacentHTML('beforeend', `
      <div id="lightbox" role="dialog" aria-modal="true" aria-label="Prohlížeč fotek">
        <button class="lightbox-btn" id="lightbox-close" type="button" aria-label="Zavřít">×</button>
        <button class="lightbox-btn lightbox-nav" id="lightbox-prev" type="button" aria-label="Předchozí fotka">‹</button>
        <div id="lightbox-stage"><img id="lightbox-img" alt=""></div>
        <button class="lightbox-btn lightbox-nav" id="lightbox-next" type="button" aria-label="Další fotka">›</button>
        <div id="lightbox-counter"></div>
      </div>`);
  }
})();

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function toast(msg, ms){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>{ t.style.display='none'; }, ms || 3200);
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
// tracks = [{ name, points }] - každá trasa je v souboru samostatná stopa (<trk>)
function tracksToGPX(tracks){
  const trks = tracks.map(t=>{
    const trkpts = t.points.map(p=>{
      const ele = p[2];
      const eleTag = (ele!=null && !isNaN(ele)) ? `<ele>${ele}</ele>` : '';
      // 4. položka bodu = čas (ms) - mají ho jen body ze záznamu jízdy
      const timeTag = p[3] ? `<time>${new Date(p[3]).toISOString()}</time>` : '';
      return `<trkpt lat="${p[0]}" lon="${p[1]}">${eleTag}${timeTag}</trkpt>`;
    }).join('');
    return `<trk><name>${escapeHtml(t.name||'trasa')}</name><trkseg>${trkpts}</trkseg></trk>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n`+
    `<gpx version="1.1" creator="CendurOFF" xmlns="http://www.topografix.com/GPX/1/1">\n`+
    trks + `\n</gpx>`;
}
function gpxFileName(tracks){
  const base = tracks.length===1 ? (tracks[0].name || 'trasa') : `CendurOFF_${tracks.length}_trasy`;
  return base.trim().replace(/[^a-z0-9_\-]+/gi,'_') + '.gpx';
}
function downloadTracks(tracks){
  const blob = new Blob([tracksToGPX(tracks)], { type:'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = gpxFileName(tracks);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function downloadGPX(points, name){ downloadTracks([{ name, points }]); }

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------------------------------------------------------------
// Komprese fotek před nahráním (šetří data) - zmenší rozlišení a překóduje
// do JPEG s postupně nižší kvalitou, dokud se vejde pod cílovou velikost.
// ---------------------------------------------------------------
function loadImageFromFile(file){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = ()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('Obrázek se nepodařilo načíst.')); };
    img.src = url;
  });
}
async function compressImage(file, opts){
  const o = Object.assign({ maxDim:1920, maxBytes:1024*1024, startQuality:0.85, minQuality:0.4 }, opts);
  if(!/^image\//.test(file.type)) return file; // ne-obrázek (nemělo by nastat) - necháme beze změny
  let img;
  try{ img = await loadImageFromFile(file); }
  catch(e){ return file; } // např. formát, co prohlížeč neumí dekódovat - zkusíme nahrát originál
  let { width, height } = img;
  if(width > o.maxDim || height > o.maxDim){
    const scale = o.maxDim / Math.max(width, height);
    width = Math.round(width*scale);
    height = Math.round(height*scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  let quality = o.startQuality;
  let blob = await new Promise(res=>canvas.toBlob(res, 'image/jpeg', quality));
  while(blob && blob.size > o.maxBytes && quality > o.minQuality){
    quality -= 0.1;
    blob = await new Promise(res=>canvas.toBlob(res, 'image/jpeg', quality));
  }
  if(!blob || blob.size >= file.size) return file; // komprese nepomohla - raději originál
  const newName = (file.name||'foto').replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], newName, { type:'image/jpeg' });
}
function fmtAvg(avg){ return Number(avg).toFixed(1).replace('.', ','); }
// krátký text s průměrem do seznamu a bubliny na mapě, např. " · ★ 4,3"
function ratingSuffix(route){
  return route.rating_count > 0 ? ` · ★ ${fmtAvg(route.rating_avg)}` : '';
}
function routeMetaText(route){
  return `${route.owner_display} · ${Number(route.distance_km).toFixed(1)} km${ratingSuffix(route)}`;
}
// ---------------------------------------------------------------
// Typy tras: barva na mapě + pořadí vrstev (vyšší z = kreslí se nad ostatními)
// ---------------------------------------------------------------
const ROUTE_TYPES = {
  transport: { label:'Transportní', color:'#1E9A45', z:430 },
  cenduro:   { label:'Cenduro',     color:'#E9851C', z:420 },
  offroad:   { label:'Offroad',     color:'#E0241B', z:410 }
};
const ROUTE_TYPE_ORDER = ['transport','cenduro','offroad'];
const SELECTED_PANE = 'route-selected';
// trasy bez typu (starší backend / starší data) se berou jako offroad
function typeOf(route){ return (route && ROUTE_TYPES[route.route_type]) ? route.route_type : 'offroad'; }
function typeInfo(route){ return ROUTE_TYPES[typeOf(route)]; }
function typeDot(type){ return `<span class="type-dot" style="background:${ROUTE_TYPES[type].color}"></span>`; }

// ---------------------------------------------------------------
// Odkaz na detail trasy (…/?trasa=12)
// ---------------------------------------------------------------
function routeIdFromUrl(){
  const n = Number(new URLSearchParams(location.search).get('trasa'));
  return Number.isInteger(n) && n > 0 ? n : null;
}
function routeShareUrl(id){
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('trasa', id);
  return u.toString();
}
// drží adresu v prohlížeči v souladu s otevřenou trasou (jde ji tak i rovnou zkopírovat z řádku)
function setUrlRoute(id){
  try{
    const u = new URL(location.href);
    if(id) u.searchParams.set('trasa', id); else u.searchParams.delete('trasa');
    history.replaceState(null, '', u);
  }catch(e){}
}
let pendingLinkId = routeIdFromUrl(); // trasa z odkazu, otevře se po přihlášení
// ?next=… – stránka, ze které byl nepřihlášený uživatel poslán na přihlášení (např. Plánovač).
// Povolené jsou jen naše vlastní stránky, ať se odkaz nedá zneužít k přesměrování jinam.
function nextPageAfterLogin(){
  const n = new URLSearchParams(location.search).get('next');
  return (n && /^planovac\.html(\?[^#]*)?$/.test(n)) ? n : null;
}
function goNextIfAny(){
  const n = nextPageAfterLogin();
  if(n){ location.replace(n); return true; }
  return false;
}
async function shareRoute(route){
  const url = routeShareUrl(route.id);
  // na telefonu systémové "Sdílet" (Messenger, WhatsApp…), na počítači zkopírování do schránky
  const isTouch = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  if(isTouch && navigator.share){
    try{ await navigator.share({ title:'CendurOFF – ' + route.name, url }); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  try{
    await navigator.clipboard.writeText(url);
    toast('Odkaz na trasu zkopírován do schránky.');
  }catch(e){
    window.prompt('Zkopíruj odkaz na trasu:', url);
  }
}
function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString('cs-CZ',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return ''; } }
// krátký numerický formát dd.m.rrrr (např. 21.10.2026) - pro datum aktualizace GPX a recenze
function fmtDateShort(iso){
  try{
    const d = new Date(iso);
    return d.getDate() + '.' + (d.getMonth()+1) + '.' + d.getFullYear();
  }catch(e){ return ''; }
}
function countWords(text){ return String(text||'').trim().split(/\s+/).filter(Boolean).length; }


 // Adresa backendu z Railway (bez lomítka na konci) - nastavuje se v public/config.js,
 // tady je jen záloha pro případ, že by config.js na webu chyběl.
const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';

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
let currentUser = null; // {id, username, displayName, role}
function isAdminUser(){ return !!(currentUser && currentUser.role === 'admin'); }
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
    if(goNextIfAny()) return;
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
// podkladové mapy - vybírají se tlačítkem 🗺 (volba se pamatuje v prohlížeči)
const BASE_MAPS = {
  cyclosm: { label:'CyclOSM – vrstevnice, stínování, povrchy cest', short:'CyclOSM',
    url:'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', maxZoom:20,
    attribution:'© OpenStreetMap contributors, CyclOSM' },
  topo:    { label:'Turistická (OpenTopoMap) – výrazné vrstevnice', short:'Turistická',
    url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom:17,
    attribution:'© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)' },
  osm:     { label:'Základní (OpenStreetMap) – bez vrstevnic', short:'Základní',
    url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom:19,
    attribution:'© OpenStreetMap contributors' },
  sat:     { label:'Satelit (Esri)', short:'Satelit',
    url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom:19,
    attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics' }
};
const BASE_ORDER = ['cyclosm','topo','osm','sat'];
const baseLayers = {};
let currentBase = BASE_MAPS[localStorage.getItem('baseMap')] ? localStorage.getItem('baseMap') : 'cyclosm';

// sbalitelný seznam tras - vysouvá se stranou pomocí jazýčku se šipkou na hraně panelu
function isMobileViewport(){ return window.matchMedia('(max-width:760px)').matches; }
const routeListEl = document.getElementById('route-list');
const routeListTab = document.getElementById('route-list-tab');
const detailPanelEl = document.getElementById('detail-panel');
// Na mobilu jsou oba panely skoro přes celou šířku, takže jejich jazýčky by se u
// okraje překrývaly. Dokud je na mobilu otevřený detail trasy, jazýček seznamu
// (který by stejně jen otevíral panel schovaný pod detailem) raději úplně schováme.
function syncMobilePanelTabs(){
  routeListTab.style.display = (isMobileViewport() && detailPanelEl.classList.contains('open')) ? 'none' : '';
}
if(localStorage.getItem('routeListCollapsed') === '1') routeListEl.classList.add('collapsed');
routeListTab.addEventListener('click', ()=>{
  const opening = routeListEl.classList.contains('collapsed');
  routeListEl.classList.toggle('collapsed');
  localStorage.setItem('routeListCollapsed', routeListEl.classList.contains('collapsed') ? '1' : '0');
  // na mobilu se oba panely (seznam tras × detail trasy) kvůli šířce nevejdou vedle sebe,
  // proto se navzájem vylučují - otevření jednoho zavře ten druhý
  if(opening && isMobileViewport() && detailPanelEl.classList.contains('open')) closeDetail();
});
// detail trasy se zavírá jazýčkem se šipkou (nahrazuje dřívější křížek)
document.getElementById('detail-panel-tab').addEventListener('click', closeDetail);
window.addEventListener('resize', syncMobilePanelTabs);

// modal "O projektu"
const aboutOverlay = document.getElementById('about-overlay');
document.getElementById('open-about').addEventListener('click', ()=> aboutOverlay.classList.add('open'));
document.getElementById('about-close').addEventListener('click', ()=> aboutOverlay.classList.remove('open'));
aboutOverlay.addEventListener('click', (e)=>{ if(e.target===aboutOverlay) aboutOverlay.classList.remove('open'); });

// modal "Můj účet" (jméno v headeru) - změna hesla
const accountOverlay = document.getElementById('account-overlay');
const changePasswordForm = document.getElementById('change-password-form');
document.getElementById('user-chip').addEventListener('click', ()=>{
  if(!currentUser) return;
  document.getElementById('account-username-label').textContent = 'Přihlášen(a) jako ' + currentUser.displayName;
  changePasswordForm.reset();
  document.getElementById('cp-msg').textContent = '';
  accountOverlay.classList.add('open');
});
document.getElementById('account-close').addEventListener('click', ()=> accountOverlay.classList.remove('open'));
document.getElementById('cp-cancel').addEventListener('click', ()=> accountOverlay.classList.remove('open'));
accountOverlay.addEventListener('click', (e)=>{ if(e.target===accountOverlay) accountOverlay.classList.remove('open'); });
changePasswordForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const msg = document.getElementById('cp-msg');
  const cur = document.getElementById('cp-current').value;
  const next = document.getElementById('cp-new').value;
  const confirmVal = document.getElementById('cp-confirm').value;
  msg.style.color = '';
  if(next.length < 4){ msg.textContent = 'Nové heslo musí mít alespoň 4 znaky.'; return; }
  if(next !== confirmVal){ msg.textContent = 'Nová hesla se neshodují.'; return; }
  msg.textContent = 'Ukládám…';
  try{
    await api('/api/auth/change-password', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ currentPassword: cur, newPassword: next })
    });
    msg.style.color = 'var(--moss-dark)';
    msg.textContent = 'Heslo bylo změněno.';
    toast('Heslo bylo změněno.');
    setTimeout(()=> accountOverlay.classList.remove('open'), 900);
  }catch(err){
    msg.textContent = err.message || 'Heslo se nepodařilo změnit.';
  }
});

function initMap(){
  if(map) return;
  map = L.map('map', { zoomControl:false }).setView([49.8711, 17.8756], 11); // výchozí pohled: Hradec nad Moravicí
  BASE_ORDER.forEach(k=>{
    const b = BASE_MAPS[k];
    // maxNativeZoom: při větším přiblížení se dlaždice jen zvětší, místo aby mapa zmizela
    baseLayers[k] = L.tileLayer(b.url, { maxZoom:19, maxNativeZoom:b.maxZoom, attribution:b.attribution });
  });
  baseLayers[currentBase].addTo(map);
  syncLayerMenu();
  // samostatná vrstva pro každý typ trasy: offroad dole, cenduro nad ním, transportní
  // nahoře; úplně navrch právě vybraná (modrá) trasa
  ROUTE_TYPE_ORDER.forEach(t=>{ map.createPane('route-' + t).style.zIndex = ROUTE_TYPES[t].z; });
  map.createPane(SELECTED_PANE).style.zIndex = 440;
  const legend = document.getElementById('route-legend');
  if(legend) legend.innerHTML = ROUTE_TYPE_ORDER.map(t=>`<span>${typeDot(t)}${ROUTE_TYPES[t].label}</span>`).join('');
}

async function loadRoutes(){
  const listEl = document.getElementById('route-items');
  const countEl = document.getElementById('route-count');
  let routes = [];
  try{
    routes = await api('/api/routes');
    // seznam tras abecedně podle názvu (česká abeceda: Č po C, Ch po H; čísla podle hodnoty)
    routes.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''), 'cs', { sensitivity:'base', numeric:true }));
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
    item.dataset.routeId = route.id;
    if(selectedIds.has(Number(route.id))) item.classList.add('picked');
    item.innerHTML = `
      <label class="visibility-toggle" title="Zobrazit/skrýt trasu na mapě">
        <input type="checkbox" class="route-visibility-checkbox" checked>
        <span class="visibility-box"></span>
      </label>
      <div class="route-item-info">
        <div class="r-name">${typeDot(typeOf(route))}${escapeHtml(route.name)}</div>
        <div class="r-meta">${escapeHtml(routeMetaText(route))}</div>
      </div>`;
    item.querySelector('.route-item-info').addEventListener('click', ()=>{
      if(selectMode){ toggleSelected(route.id); return; }
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
    // najetí myší na trasu v seznamu ji zvýrazní na mapě (stejně jako najetí přímo na čáru)
    item.addEventListener('mouseenter', ()=> hoverRouteFromList(route.id, true));
    item.addEventListener('mouseleave', ()=> hoverRouteFromList(route.id, false));
    item.querySelector('.route-visibility-checkbox').addEventListener('change', (e)=>{
      const layer = layersById[route.id];
      if(!layer) return;
      if(e.target.checked) layer.addTo(map);
      else map.removeLayer(layer);
    });
    listEl.appendChild(item);
  });
  // po znovunačtení nech ve výběru jen trasy, které pořád existují
  selectedIds.forEach(rid=>{ if(!routesCache[rid]) selectedIds.delete(rid); });
  Object.keys(layersById).forEach(applyRouteStyle);
  updateSelectionBar();
}

const ROUTE_COLOR_SELECTED = '#1E64D6';
const ROUTE_COLOR_HOVER = '#7EB6FF'; // světlejší modrá než vybraná trasa - pro najetí myší

const STYLE_SELECTED = { color:ROUTE_COLOR_SELECTED, weight:6, opacity:1 };
const STYLE_HOVER = { color:ROUTE_COLOR_HOVER, weight:6, opacity:1 };
function normalStyle(id){
  return { color: typeInfo(routesCache[id]).color, weight:4, opacity:0.9 };
}

// Je trasa "modrá"? Buď je otevřená v detailu, nebo je zaškrtnutá ve výběru více tras.
function isRouteMarked(id){
  return selectMode ? selectedIds.has(Number(id)) : Number(id)===Number(activeRouteId);
}
// Přesune čáru do jiné vrstvy mapy (Leaflet to umí jen přes odebrání a opětovné přidání).
function setLayerPane(layer, pane){
  if(layer.options.pane === pane) return;
  const onMap = map.hasLayer(layer);
  if(onMap) map.removeLayer(layer);
  layer.options.pane = pane;
  if(onMap) layer.addTo(map);
}
function applyRouteStyle(id){
  const layer = layersById[id];
  if(!layer) return;
  if(isRouteMarked(id)){
    setLayerPane(layer, SELECTED_PANE);
    layer.setStyle(STYLE_SELECTED);
    layer.bringToFront();
  } else {
    setLayerPane(layer, 'route-' + typeOf(routesCache[id]));
    layer.setStyle(normalStyle(id));
  }
}
function hoverRouteFromList(id, on){
  const layer = layersById[id];
  if(!layer || !map.hasLayer(layer) || isRouteMarked(id)) return;
  if(on){
    // dočasně do nejvyšší vrstvy, ať zvýrazněná trasa není schovaná pod ostatními
    setLayerPane(layer, SELECTED_PANE);
    layer.setStyle(STYLE_HOVER);
    layer.bringToFront();
  } else {
    applyRouteStyle(id);
  }
}
function routeTipHtml(route){
  return `<b>${escapeHtml(route.name)}</b><br>${typeInfo(route).label} · ${escapeHtml(routeMetaText(route))}`;
}

function drawRoute(route){
  const latlngs = route.points.map(p=>[p[0],p[1]]);
  const line = L.polyline(latlngs, Object.assign({ pane:'route-' + typeOf(route) }, normalStyle(route.id))).addTo(map);
  line.bindTooltip(routeTipHtml(route), { sticky:true, className:'trail-tip' });
  line.on('mouseover', ()=>{ if(!isRouteMarked(route.id)) line.setStyle(STYLE_HOVER); });
  line.on('mouseout', ()=> applyRouteStyle(route.id));
  line.on('click', ()=>{
    if(selectMode) toggleSelected(route.id);
    else openDetail(route.id);
  });
  layersById[route.id] = line;
}

function highlightRoute(){
  Object.keys(layersById).forEach(applyRouteStyle);
}

// ---------------------------------------------------------------
// Výběr více tras (hromadné stažení do jednoho GPX)
// ---------------------------------------------------------------
let selectMode = false;
const selectedIds = new Set();
const selectToggleBtn = document.getElementById('select-mode-btn');
const selectionBar = document.getElementById('selection-bar');
const selectionCount = document.getElementById('selection-count');
const selectionDownloadBtn = document.getElementById('selection-download');

function updateSelectionBar(){
  selectionBar.classList.toggle('open', selectMode);
  routeListEl.classList.toggle('selecting', selectMode);
  selectToggleBtn.classList.toggle('active', selectMode);
  selectToggleBtn.textContent = selectMode ? 'Ukončit výběr' : 'Stáhnout více tras';
  const n = selectedIds.size;
  selectionCount.textContent = n===0 ? 'Klikej na trasy na mapě nebo v seznamu' : 'Vybráno tras: ' + n;
  selectionDownloadBtn.disabled = n===0;
}
function setSelectMode(on){
  selectMode = on;
  if(on) closeDetail();
  else selectedIds.clear();
  document.querySelectorAll('.route-item.picked').forEach(el=>el.classList.remove('picked'));
  Object.keys(layersById).forEach(applyRouteStyle);
  updateSelectionBar();
}
function toggleSelected(id){
  id = Number(id);
  if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
  const item = document.querySelector(`.route-item[data-route-id="${id}"]`);
  if(item){
    item.classList.toggle('picked', selectedIds.has(id));
    // vybraná trasa musí být na mapě vidět, i kdyby byla předtím skrytá
    const layer = layersById[id];
    if(selectedIds.has(id) && layer && !map.hasLayer(layer)){
      layer.addTo(map);
      const cb = item.querySelector('.route-visibility-checkbox');
      if(cb) cb.checked = true;
    }
  }
  applyRouteStyle(id);
  updateSelectionBar();
}
function selectedTracks(){
  return Array.from(selectedIds).map(rid=>routesCache[rid]).filter(Boolean)
    .map(r=>({ name:r.name, points:r.points }));
}
selectToggleBtn.addEventListener('click', ()=> setSelectMode(!selectMode));
document.getElementById('selection-cancel').addEventListener('click', ()=> setSelectMode(false));
selectionDownloadBtn.addEventListener('click', ()=> downloadTracks(selectedTracks()));

// ---------------------------------------------------------------
// Hodnocení tras
// ---------------------------------------------------------------
function ratingSummaryText(route){
  if(!route.rating_count) return 'Zatím bez hodnocení';
  return `${fmtAvg(route.rating_avg)} z 5 · ${route.rating_count}× hodnoceno`;
}
function renderRatingBlock(route){
  const mine = route.my_rating || 0;
  const stars = [1,2,3,4,5].map(n=>
    `<button type="button" class="star-btn${n<=mine ? ' on' : ''}" data-stars="${n}"
       aria-label="${n} z 5 hvězdiček" aria-pressed="${n===mine}">★</button>`).join('');
  return `
    <div class="rating-block" id="rating-block">
      <div class="rating-avg">
        <span class="rating-avg-star">★</span>
        <span id="rating-summary">${ratingSummaryText(route)}</span>
      </div>
      <div class="rating-mine">
        <div class="star-row" id="star-row">${stars}</div>
        <span class="rating-hint" id="rating-hint">${mine ? 'Tvoje hodnocení – stejnou hvězdičkou ho zrušíš' : 'Ohodnoť trasu'}</span>
      </div>
    </div>`;
}
// promítne nové hodnocení do detailu, seznamu tras i bubliny na mapě
function applyRatingToUi(route){
  const summary = document.getElementById('rating-summary');
  if(summary) summary.textContent = ratingSummaryText(route);
  const hint = document.getElementById('rating-hint');
  if(hint) hint.textContent = route.my_rating ? 'Tvoje hodnocení – stejnou hvězdičkou ho zrušíš' : 'Ohodnoť trasu';
  document.querySelectorAll('#star-row .star-btn').forEach(btn=>{
    const n = Number(btn.dataset.stars);
    btn.classList.toggle('on', n <= (route.my_rating||0));
    btn.setAttribute('aria-pressed', String(n === route.my_rating));
  });
  const cached = routesCache[route.id];
  if(cached){
    cached.rating_avg = route.rating_avg;
    cached.rating_count = route.rating_count;
    const meta = document.querySelector(`.route-item[data-route-id="${route.id}"] .r-meta`);
    if(meta) meta.textContent = routeMetaText(cached);
    if(layersById[route.id]) layersById[route.id].setTooltipContent(routeTipHtml(cached));
  }
}
function bindRating(route){
  const row = document.getElementById('star-row');
  if(!row) return;
  let busy = false;
  row.querySelectorAll('.star-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(busy) return;
      busy = true;
      const stars = Number(btn.dataset.stars);
      const removing = route.my_rating === stars; // klik na už zvolenou hvězdičku = zrušit
      try{
        const result = removing
          ? await api(`/api/routes/${route.id}/rating`, { method:'DELETE' })
          : await api(`/api/routes/${route.id}/rating`, {
              method:'PUT',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ stars })
            });
        Object.assign(route, result);
        applyRatingToUi(route);
        toast(removing ? 'Hodnocení odebráno.' : 'Hodnocení uloženo.');
      }catch(e){
        toast(e.message || 'Hodnocení se nepodařilo uložit.');
      }finally{
        busy = false;
      }
    });
  });
}

// ---------------------------------------------------------------
// Recenze tras (text, max 200 slov, jedna recenze na uživatele a trasu)
// - celý panel je <details>, sbalený ve výchozím stavu, ať při běžném
//   prohlížení trasy nepřekáží a nezatěžuje pohled.
// ---------------------------------------------------------------
function reviewItemHtml(r, isMine){
  const adminDel = (!isMine && isAdminUser())
    ? `<div class="review-mine-actions"><button class="ghost-btn admin-del-review" data-user="${r.user_id}" type="button">Smazat (admin)</button></div>` : '';
  return `
    <div class="review-item${isMine ? ' review-mine' : ''}">
      <div class="review-head"><b>${escapeHtml(r.author_display)}${isMine ? ' (ty)' : ''}</b><span>${fmtDateShort(r.updated_at)}</span></div>
      <div class="review-text">${escapeHtml(r.text)}</div>
      ${isMine ? `<div class="review-mine-actions">
        <button class="ghost-btn" id="edit-review-btn" type="button">Upravit</button>
        <button class="ghost-btn" id="delete-review-btn" type="button">Smazat</button>
      </div>` : adminDel}
    </div>`;
}
function reviewFormHtml(mine){
  return `
    <div class="review-form" id="review-form"${mine ? ' style="display:none;"' : ''}>
      <textarea id="review-text" maxlength="4000" placeholder="Napiš svou zkušenost s trasou (max. 200 slov)…">${mine ? escapeHtml(mine.text) : ''}</textarea>
      <div class="review-form-foot">
        <span class="review-counter" id="review-counter">0 / 200 slov</span>
        <div class="review-form-actions">
          ${mine ? `<button class="ghost-btn" id="cancel-review-edit" type="button">Zrušit</button>` : ''}
          <button class="primary-btn" id="save-review-btn" type="button" style="margin-top:0;">${mine ? 'Uložit změnu' : 'Přidat recenzi'}</button>
        </div>
      </div>
      <div class="form-msg" id="review-msg"></div>
    </div>`;
}
function renderReviewsBlock(reviews){
  const mine = currentUser ? reviews.find(r => r.user_id === currentUser.id) : null;
  const others = reviews.filter(r => !mine || r.id !== mine.id);
  const listHtml = others.map(r=>reviewItemHtml(r,false)).join('');
  const emptyHtml = (!mine && others.length===0) ? '<p class="hint">Zatím tu není žádná recenze. Buď první.</p>' : '';
  const mineHtml = mine ? reviewItemHtml(mine, true) : '';
  const formHtml = currentUser ? reviewFormHtml(mine) : '<p class="hint">Pro napsání recenze se musíš přihlásit.</p>';
  return `
    <details class="reviews-block" id="reviews-block">
      <summary>Recenze <span class="count">(${reviews.length})</span></summary>
      <div class="reviews-inner">
        ${mineHtml}
        ${emptyHtml}
        ${listHtml}
        ${formHtml}
      </div>
    </details>`;
}
function bindReviews(routeId, reviews){
  const block = document.getElementById('reviews-block');
  if(!block) return;
  const textEl = document.getElementById('review-text');
  const counterEl = document.getElementById('review-counter');
  const saveBtn = document.getElementById('save-review-btn');
  const msgEl = document.getElementById('review-msg');
  const editBtn = document.getElementById('edit-review-btn');
  const deleteBtn = document.getElementById('delete-review-btn');
  const cancelBtn = document.getElementById('cancel-review-edit');
  const formEl = document.getElementById('review-form');

  function updateCounter(){
    if(!textEl || !counterEl) return;
    const words = countWords(textEl.value);
    counterEl.textContent = words + ' / 200 slov';
    counterEl.classList.toggle('over', words > 200);
  }
  if(textEl){ textEl.addEventListener('input', updateCounter); updateCounter(); }
  if(editBtn) editBtn.addEventListener('click', ()=>{
    formEl.style.display = 'block';
    formEl.scrollIntoView({ behavior:'smooth', block:'nearest' });
    if(textEl) textEl.focus();
  });
  if(cancelBtn) cancelBtn.addEventListener('click', ()=>{ formEl.style.display = 'none'; });
  block.querySelectorAll('.admin-del-review').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Smazat tuto recenzi jako admin?')) return;
      try{
        const result = await api(`/api/routes/${routeId}/review?userId=${encodeURIComponent(btn.dataset.user)}`, { method:'DELETE' });
        toast('Recenze smazána.');
        refreshReviewsBlock(routeId, result.reviews);
      }catch(e){ toast(e.message || 'Recenzi se nepodařilo smazat.'); }
    });
  });
  if(deleteBtn) deleteBtn.addEventListener('click', async ()=>{
    if(!confirm('Smazat svou recenzi?')) return;
    try{
      const result = await api(`/api/routes/${routeId}/review`, { method:'DELETE' });
      toast('Recenze smazána.');
      refreshReviewsBlock(routeId, result.reviews);
    }catch(e){ toast(e.message || 'Recenzi se nepodařilo smazat.'); }
  });
  if(saveBtn) saveBtn.addEventListener('click', async ()=>{
    const text = (textEl.value||'').trim();
    const words = countWords(text);
    if(!text){ msgEl.textContent = 'Napiš text recenze.'; return; }
    if(words > 200){ msgEl.textContent = `Recenze může mít nejvýš 200 slov (teď ${words}).`; return; }
    msgEl.textContent = 'Ukládám…';
    saveBtn.disabled = true;
    try{
      const result = await api(`/api/routes/${routeId}/review`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text })
      });
      toast('Recenze uložena.');
      refreshReviewsBlock(routeId, result.reviews);
    }catch(e){
      msgEl.textContent = e.message || 'Recenzi se nepodařilo uložit.';
    }finally{
      saveBtn.disabled = false;
    }
  });
}
// znovu vykreslí panel recenzí po uložení/smazání a nechá ho otevřený, ať je výsledek vidět
function refreshReviewsBlock(routeId, reviews){
  const old = document.getElementById('reviews-block');
  if(!old) return;
  old.outerHTML = renderReviewsBlock(reviews);
  const now = document.getElementById('reviews-block');
  if(now) now.open = true;
  bindReviews(routeId, reviews);
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
  if(selectMode) setSelectMode(false);
  activeRouteId = id;
  setUrlRoute(id);
  highlightRoute(id);
  const panel = document.getElementById('detail-panel');
  const inner = document.getElementById('detail-inner');
  inner.innerHTML = '<div class="empty-note">Načítání…</div>';
  panel.classList.add('open');
  // na mobilu se detail a seznam tras kvůli šířce nevejdou vedle sebe - seznam se schová
  if(isMobileViewport()) routeListEl.classList.add('collapsed');
  syncMobilePanelTabs();

  let route, photos = [], reviews = [];
  try{
    const data = await api('/api/routes/'+id);
    route = data.route;
    photos = data.photos;
    reviews = data.reviews || [];
  }catch(e){
    inner.innerHTML = '<div class="empty-note">Trasu se nepodařilo načíst.</div>';
    return;
  }

  // upravovat smí vlastník trasy, nebo admin (ten může upravovat trasy všech)
  const isRealOwner = !!(currentUser && currentUser.id === route.owner_id);
  const isOwner = isRealOwner || isAdminUser();

  const photoSlots = [0,1,2].map(i=>{
    const p = photos[i];
    if(!p){
      return `<div class="photo-slot"><span class="empty-plus">·</span></div>`;
    }
    return `<div class="photo-slot">
        <img class="photo-thumb" data-index="${i}" src="${p.data_url}" alt="Fotka trasy ${escapeHtml(route.name)}" title="Zvětšit fotku">
        ${p.is_main ? '<span class="main-badge">HLAVNÍ</span>' : ''}
        ${isOwner ? `<button class="delete-photo-btn" data-photo="${p.id}" title="Smazat fotku">×</button>` : ''}
        ${isOwner && !p.is_main ? `<button class="set-main-btn" data-photo="${p.id}">Nastavit jako hlavní</button>` : ''}
      </div>`;
  }).join('');

  inner.innerHTML = `
    <h2>${escapeHtml(route.name)}</h2>
    <div class="type-chip">${typeDot(typeOf(route))}${typeInfo(route).label} trasa</div>
    <div class="detail-owner">Přidal(a) ${escapeHtml(route.owner_display)} · ${fmtDate(route.created_at)}${route.gpx_updated_at ? `<br>GPX aktualizováno dne: ${fmtDateShort(route.gpx_updated_at)}` : ''}</div>
    ${route.description ? `<div class="detail-desc" id="detail-desc-text">${escapeHtml(route.description)}</div>` : ''}
    ${renderRatingBlock(route)}
    ${renderReviewsBlock(reviews)}
    ${isOwner ? `
      <div class="edit-route-form" id="edit-route-form" style="display:none;">
        <label for="edit-route-name">Název trasy</label>
        <input type="text" id="edit-route-name" value="${escapeHtml(route.name)}">
        <label for="edit-route-desc">Popis</label>
        <textarea id="edit-route-desc">${escapeHtml(route.description||'')}</textarea>
        <label for="edit-route-type">Typ trasy</label>
        <select id="edit-route-type">
          ${ROUTE_TYPE_ORDER.map(t=>`<option value="${t}"${t===typeOf(route) ? ' selected' : ''}>${ROUTE_TYPES[t].label}</option>`).join('')}
        </select>
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
    <div class="gpx-actions">
      <button class="ghost-btn" id="download-gpx-btn" type="button">⬇ Stáhnout GPX</button>
      <button class="ghost-btn" id="share-route-btn" type="button">🔗 Sdílet odkaz</button>
      ${isOwner ? `<a class="ghost-btn planner-link" href="planovac.html?trasa=${route.id}">✏️ Upravit v plánovači</a>` : ''}
    </div>
    <div class="elev-profile">
      <h3>Výškový profil</h3>
      ${renderElevationProfile(route.points)}
    </div>
    <div class="photo-grid">${photoSlots}</div>
    ${isOwner ? `
      <div class="owner-controls">
        <h3>Fotky trasy</h3>
        ${isRealOwner ? '' : '<p class="hint admin-note">Upravuješ jako admin – trasa patří uživateli ' + escapeHtml(route.owner_display) + '.</p>'}
        <p class="hint">Jako vlastník trasy můžete nahrát až 3 fotky a vybrat, která bude hlavní (max 3 MB na fotku).</p>
        <input type="file" id="photo-input" accept="image/*" ${photos.length>=3 ? 'disabled' : ''}>
        ${photos.length>=3 ? '<p class="hint">Všechny 3 sloty jsou obsazené.</p>' : ''}
        <button class="ghost-btn" id="edit-route-btn" style="width:100%;margin-top:14px;">Upravit trasu (název, popis, typ)</button>
        <h3 style="margin-top:18px;">Nahradit GPX soubor</h3>
        <p class="hint">Nahrajte aktuálnější GPX - nahradí body, vzdálenost i převýšení současné trasy (název a popis zůstanou).</p>
        <input type="file" id="replace-gpx-input" accept=".gpx">
        <button class="danger-btn" id="delete-route-btn">Smazat trasu</button>
      </div>` : ''}
  `;

  document.getElementById('download-gpx-btn').addEventListener('click', ()=> downloadGPX(route.points, route.name));
  document.getElementById('share-route-btn').addEventListener('click', ()=> shareRoute(route));
  bindRating(route);
  bindReviews(route.id, reviews);
  inner.querySelectorAll('.photo-thumb').forEach(img=>{
    img.addEventListener('click', ()=> openLightbox(photos.map(p=>p.data_url), Number(img.dataset.index), route.name));
  });

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
          body: JSON.stringify({ name:newName, description:newDesc, routeType: document.getElementById('edit-route-type').value })
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
        // velký vstupní soubor odmítneme ještě před kompresí (ochrana proti extrémně velkým souborům)
        if(file.size > 20*1024*1024){ toast('Obrázek je příliš velký (max 20 MB).'); return; }
        toast('Zmenšuji fotku…', 1500);
        let toUpload = file;
        try{ toUpload = await compressImage(file); }catch(e){ /* komprese selhala - zkusíme originál */ }
        if(toUpload.size > 3*1024*1024){ toast('Obrázek je příliš velký i po zmenšení (max 3 MB).'); return; }
        try{
          const fd = new FormData();
          fd.append('photo', toUpload);
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

// ---------------------------------------------------------------
// Prohlížeč fotek (zvětšení + listování)
// ---------------------------------------------------------------
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCounter = document.getElementById('lightbox-counter');
let lightboxPhotos = [], lightboxIndex = 0;

function showLightboxPhoto(i){
  const n = lightboxPhotos.length;
  lightboxIndex = (i + n) % n; // za poslední fotkou se pokračuje zase první
  lightboxImg.src = lightboxPhotos[lightboxIndex];
  lightboxCounter.textContent = n > 1 ? (lightboxIndex+1) + ' / ' + n : '';
}
function openLightbox(urls, index, routeName){
  if(!urls.length) return;
  lightboxPhotos = urls;
  lightboxImg.alt = 'Fotka trasy ' + (routeName||'');
  lightbox.classList.toggle('single', urls.length < 2);
  showLightboxPhoto(index);
  lightbox.classList.add('open');
}
function closeLightbox(){
  lightbox.classList.remove('open');
  lightboxImg.removeAttribute('src');
}
function lightboxStep(d){ if(lightboxPhotos.length > 1) showLightboxPhoto(lightboxIndex + d); }

document.getElementById('lightbox-prev').addEventListener('click', (e)=>{ e.stopPropagation(); lightboxStep(-1); });
document.getElementById('lightbox-next').addEventListener('click', (e)=>{ e.stopPropagation(); lightboxStep(1); });
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
// klik mimo fotku (do tmavého pozadí) prohlížeč zavře
lightbox.addEventListener('click', (e)=>{ if(e.target===lightbox || e.target.id==='lightbox-stage') closeLightbox(); });
document.addEventListener('keydown', (e)=>{
  if(!lightbox.classList.contains('open')) return;
  if(e.key==='ArrowLeft'){ e.preventDefault(); lightboxStep(-1); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); lightboxStep(1); }
  else if(e.key==='Escape'){ e.preventDefault(); closeLightbox(); }
});
// mobil: listování tažením prstu doleva / doprava
let lbTouchX = null, lbTouchY = null;
lightbox.addEventListener('touchstart', (e)=>{
  if(e.touches.length!==1){ lbTouchX = null; return; }
  lbTouchX = e.touches[0].clientX; lbTouchY = e.touches[0].clientY;
}, { passive:true });
lightbox.addEventListener('touchend', (e)=>{
  if(lbTouchX==null) return;
  const dx = e.changedTouches[0].clientX - lbTouchX;
  const dy = e.changedTouches[0].clientY - lbTouchY;
  lbTouchX = null;
  if(Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)*1.5) lightboxStep(dx < 0 ? 1 : -1);
}, { passive:true });

function closeDetail(){
  closeLightbox();
  setUrlRoute(null);
  document.getElementById('detail-panel').classList.remove('open');
  activeRouteId = null;
  Object.keys(layersById).forEach(applyRouteStyle);
  syncMobilePanelTabs();
}

// ---------------------------------------------------------------
// Upload modal
// ---------------------------------------------------------------
const overlay = document.getElementById('upload-overlay');
document.getElementById('open-upload').addEventListener('click', ()=>{
  document.getElementById('gpx-file').value='';
  document.getElementById('route-name').value='';
  document.getElementById('route-desc').value='';
  document.getElementById('route-type').value='';
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
  const routeType = document.getElementById('route-type').value;
  if(!routeType){ msg.textContent='Vyberte typ trasy.'; return; }
  if(!pendingPoints){ msg.textContent='GPX soubor se ještě nepodařilo přečíst, zkuste ho vybrat znovu.'; return; }
  msg.textContent='Nahrávám…';
  try{
    const route = await api('/api/routes', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, description: desc, points: pendingPoints, routeType })
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
const HEADING_FILTER_ALPHA_COMPASS = 0.06; // vyhlazení kompasu (silný filtr - magnetometr je v klidu i za jízdy dost "cukavý")
const HEADING_UPDATE_THRESHOLD_DEG_GPS = 4;      // GPS kurz: změny menší než toto se ignorují
const HEADING_UPDATE_THRESHOLD_DEG_COMPASS = 9;  // kompas: vyšší práh, ať drobné chvění v klidu vůbec neprojde
const HEADING_MIN_UPDATE_MS_GPS = 120;           // GPS: přepočet natočení max ~8x/s
const HEADING_MIN_UPDATE_MS_COMPASS = 280;       // kompas: přepočet pomalejší, max ~3-4x/s
const FOLLOW_MARKER_Y_FRACTION = 2/3;      // poloha šipky na obrazovce při sledování (0=nahoře, 1=dole); 2/3 = "jedna třetina od spodu"

// Vycentruje mapu tak, aby se GPS bod nezobrazil uprostřed obrazovky, ale
// v dolní třetině (FOLLOW_MARKER_Y_FRACTION) - ať je vidět víc mapy před sebou.
// Posun se počítá ve směru aktuálního natočení mapy (v režimu "směr jízdy" tedy
// ve směru jízdy), takže funguje správně i po otočení/zvětšení mapy.
function setFollowView(latlng, animate){
  const z = map.getZoom();
  // výška viditelné části mapy (v režimu "směr jízdy" je samotný #map větší než obrazovka)
  const visibleH = mapEl.parentElement.clientHeight;
  const theta = (headingMode==='heading') ? displayedHeading * Math.PI/180 : 0;
  const k = (FOLLOW_MARKER_Y_FRACTION - 0.5) * visibleH;
  const targetPx = map.project(latlng, z);
  const dx = Math.sin(theta) * k;
  const dy = Math.cos(theta) * k;
  const center = map.unproject(L.point(targetPx.x + dx, targetPx.y - dy), z);
  map.setView(center, z, { animate: !!animate });
}

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

// Fullscreen + satelitní tlačítko jsou (kvůli overflow:hidden na main.mapwrap)
// mimo mapu, přímo v #app-screen - jejich "top" proto dopočítáváme podle reálné
// výšky hlavičky (ta se na mobilu může zalomit na 2 řádky a mění výšku podle
// obsahu), ať tlačítka nikdy nepřekrývají tlačítka v hlavičce.
function positionFloatingMapButtons(){
  const header = document.querySelector('header.topbar');
  const sat = document.getElementById('satellite-btn');
  const full = document.getElementById('fullscreen-btn');
  const fuel = document.getElementById('fuel-btn');
  if(!header || !sat || !full) return;
  const top = Math.round(header.getBoundingClientRect().bottom) + 8;
  sat.style.top = top + 'px';
  full.style.top = top + 'px';
  if(fuel) fuel.style.top = top + 'px';
}
window.addEventListener('resize', positionFloatingMapButtons);
window.addEventListener('load', positionFloatingMapButtons);
positionFloatingMapButtons();
setTimeout(positionFloatingMapButtons, 300);

// tlačítko 🗺 (dřív jen satelit) otevírá nabídku podkladových map
const satelliteBtn = document.getElementById('satellite-btn');
satelliteBtn.textContent = '🗺';
satelliteBtn.title = 'Podkladová mapa (vrstevnice, satelit…)';
document.body.insertAdjacentHTML('beforeend', `<div id="layer-menu" role="menu">
  <div class="layer-menu-title">Podkladová mapa</div>
  ${BASE_ORDER.map(k=>`<button type="button" class="layer-opt" data-base="${k}" role="menuitemradio"><span class="layer-radio"></span>${BASE_MAPS[k].label}</button>`).join('')}
</div>`);
const layerMenu = document.getElementById('layer-menu');
function syncLayerMenu(){
  layerMenu.querySelectorAll('.layer-opt').forEach(b=>{
    const on = b.dataset.base === currentBase;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
}
function setBaseMap(k){
  if(!map || !BASE_MAPS[k] || k===currentBase) return;
  map.removeLayer(baseLayers[currentBase]);
  currentBase = k;
  baseLayers[k].addTo(map);
  try{ localStorage.setItem('baseMap', k); }catch(e){}
  syncLayerMenu();
}
function placeLayerMenu(){
  const r = satelliteBtn.getBoundingClientRect();
  layerMenu.style.top = Math.round(r.bottom + 8) + 'px';
  layerMenu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
}
satelliteBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  placeLayerMenu();
  layerMenu.classList.toggle('open');
});
layerMenu.addEventListener('click', (e)=>{
  const b = e.target.closest('.layer-opt');
  if(!b) return;
  setBaseMap(b.dataset.base);
  layerMenu.classList.remove('open');
  toast('Mapa: ' + BASE_MAPS[b.dataset.base].short, 1800);
});
document.addEventListener('click', (e)=>{
  if(layerMenu.classList.contains('open') && !layerMenu.contains(e.target) && e.target !== satelliteBtn) layerMenu.classList.remove('open');
});
window.addEventListener('resize', ()=>{ if(layerMenu.classList.contains('open')) placeLayerMenu(); });

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
// ho promítne jen tehdy, když se změnil o víc než thresholdDeg a zároveň uplynul
// minUpdateMs od poslední aktualizace - to potlačuje chvění mapy. GPS a kompas mají
// vlastní (odlišné) hodnoty prahu, protože kompas je výrazně šumnější zdroj.
function feedHeading(rawDeg, alpha, thresholdDeg, minUpdateMs){
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
  if(change >= thresholdDeg && (now - lastHeadingUpdateTs) >= minUpdateMs){
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
    feedHeading(pos.coords.heading, HEADING_FILTER_ALPHA_GPS, HEADING_UPDATE_THRESHOLD_DEG_GPS, HEADING_MIN_UPDATE_MS_GPS);
  }

  if(followMode) setFollowView(latlng, true);
  recOnPosition(pos);
}
function onPositionError(err){
  // vypršení času / dočasně nedostupná poloha (slabý signál v lese) není důvod vypínat
  // sledování ani záznam - watchPosition běží dál a polohu pošle, až ji zase bude mít
  if(err && (err.code === 2 || err.code === 3) && watchId != null){
    if(!lastLatLng) toast('Čekám na GPS signál…');
    return;
  }
  // zamítnuté oprávnění: odběr zrušíme, ať další klik na tlačítko polohy požádá znovu
  if(err && err.code === 1 && watchId != null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  toast('Polohu se nepodařilo získat: ' + (err.message || 'neznámá chyba'));
  followMode = false;
  locateBtn.classList.remove('active');
  locateBtnLabel.textContent = 'Nesleduji polohu';
}

// Zapne odběr GPS (pokud ještě neběží) a režim "sleduji polohu".
// Volá ho tlačítko polohy i spuštění záznamu jízdy.
function startGpsWatch(){
  if(!navigator.geolocation){ toast('Prohlížeč nepodporuje GPS polohu.'); return false; }
  if(watchId!=null) return true;
  followMode = true;
  locateBtn.classList.add('active');
  locateBtnLabel.textContent = 'Sleduji polohu';
  headingBtn.disabled = false;
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy:true, maximumAge:2000, timeout:15000 });
  return true;
}

locateBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){ toast('Prohlížeč nepodporuje GPS polohu.'); return; }
  if(watchId==null){
    startGpsWatch();
  } else if(!followMode){
    followMode = true;
    locateBtn.classList.add('active');
    locateBtnLabel.textContent = 'Sleduji polohu';
    if(lastLatLng) setFollowView(lastLatLng, false);
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
    feedHeading(heading, HEADING_FILTER_ALPHA_COMPASS, HEADING_UPDATE_THRESHOLD_DEG_COMPASS, HEADING_MIN_UPDATE_MS_COMPASS);
  };
  window.addEventListener('deviceorientationabsolute', handler, true);
  window.addEventListener('deviceorientation', handler, true);
}

// V režimu "směr jízdy" se mapa otáčí. Aby při otočení nebyly v rozích vidět prázdné
// kusy, je #map zvětšený na čtverec o straně úhlopříčky obrazovky a vystředěný -
// mapa se tedy NEzvětšuje (žádné scale), úroveň přiblížení zůstává, jaká byla.
function layoutMapForMode(){
  const wrap = mapEl.parentElement;
  if(headingMode==='heading'){
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const d = Math.ceil(Math.hypot(w, h));
    mapEl.style.inset = 'auto';
    mapEl.style.left = ((w - d) / 2) + 'px';
    mapEl.style.top = ((h - d) / 2) + 'px';
    mapEl.style.width = d + 'px';
    mapEl.style.height = d + 'px';
  } else {
    mapEl.style.inset = '';
    mapEl.style.left = mapEl.style.top = mapEl.style.width = mapEl.style.height = '';
  }
  // Leaflet si přepočítá rozměry; střed mapy i přiblížení přitom zůstanou stejné
  map.invalidateSize({ animate:false });
}
window.addEventListener('resize', ()=>{ if(map && headingMode==='heading') layoutMapForMode(); });

function setMapRotation(on){
  if(on){
    mapEl.style.transform = 'rotate(' + (-displayedHeading) + 'deg)';
    // ikonky benzínek se otáčejí zpět, ať zůstávají "rovně" i na otočené mapě
    mapEl.style.setProperty('--map-rot', displayedHeading + 'deg');
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    // Šipka je vnořená uvnitř #map, takže zdědí i jeho rotaci (rotace se v CSS sčítají).
    // Aby vizuálně zůstala pořád "nahoru" (jako ukazatel směru jízdy) a ne přilepená
    // k severu na otáčející se mapě, musí mít opačnou (kompenzující) rotaci -
    // tedy přesně +displayedHeading, aby se s rotací mapy (-displayedHeading) vyrušila na 0.
    updateArrowRotation(displayedHeading);
  } else {
    mapEl.style.transform = 'none';
    mapEl.style.setProperty('--map-rot', '0deg');
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
    layoutMapForMode();
    setMapRotation(true);
  } else {
    headingMode = 'north';
    headingBtn.classList.remove('active');
    headingBtnLabel.textContent = 'Sever nahoru';
    layoutMapForMode();
    setMapRotation(false);
  }
  // Po přepnutí režimu se mění rotace mapy, takže dolní-třetinový posun
  // přepočítáme rovnou, ať šipka neposkočí na chvíli jinam.
  if(followMode && lastLatLng) setFollowView(lastLatLng, true);
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
// Čerpací stanice (benzínky) na mapě - data z OpenStreetMap přes Overpass API
// - načítají se po dlaždicích podle výřezu mapy (od přiblížení FUEL_MIN_ZOOM),
//   výsledky se pamatují v prohlížeči na týden, ať se nestahují pořád dokola
// - zapíná/vypíná je tlačítko ⛽ (stav se pamatuje)
// ---------------------------------------------------------------
const FUEL_MIN_ZOOM = 10;
const FUEL_TILE_DEG = 0.25;
const FUEL_CACHE_DAYS = 7;
const FUEL_CACHE_PREFIX = 'cenduroff.fuel.';
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const FUEL_SVG = '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M4 3h9a1 1 0 0 1 1 1v8h1.5a2.5 2.5 0 0 1 2.5 2.5V18a1 1 0 0 0 2 0v-6.6l-2.7-2.7a1 1 0 1 1 1.4-1.4l3 3a1 1 0 0 1 .3.7V18a3 3 0 0 1-6 0v-3.5a.5.5 0 0 0-.5-.5H14v7h1a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2h1V4a1 1 0 0 1 1-1zm1.5 2v5h6V5h-6z"/></svg>';

let fuelOn = localStorage.getItem('fuelOn') !== '0';
let fuelLayer = null, fuelHintShown = false, fuelErrorShown = false;
const fuelTiles = {};          // klíč dlaždice -> 'loading' | 'done'
const fuelSeen = new Set();    // id stanic už přidaných na mapu
const fuelQueue = [];
let fuelBusy = false;
const fuelBtn = document.getElementById('fuel-btn');

function fuelIcon(){
  return L.divIcon({ className:'fuel-marker', html:`<div class="fuel-ico">${FUEL_SVG}</div>`, iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-10] });
}
function fuelTileKey(x, y){ return x + '_' + y; }
function addFuelStations(items){
  if(!fuelLayer) return;
  items.forEach(st=>{
    if(fuelSeen.has(st.id)) return;
    fuelSeen.add(st.id);
    const title = st.name || st.brand || 'Čerpací stanice';
    const extra = [st.brand && st.brand !== title ? st.brand : '', st.hours ? 'Otevřeno: ' + st.hours : ''].filter(Boolean);
    const m = L.marker([st.lat, st.lon], { icon:fuelIcon(), keyboard:false, zIndexOffset:-500 });
    m.bindTooltip(escapeHtml(title), { direction:'top', offset:[0,-10], className:'trail-tip' });
    m.bindPopup(`<div class="fuel-popup"><b>⛽ ${escapeHtml(title)}</b>${extra.map(e=>`<div>${escapeHtml(e)}</div>`).join('')}</div>`);
    m.addTo(fuelLayer);
  });
}
function readFuelCache(key){
  try{
    const c = JSON.parse(localStorage.getItem(FUEL_CACHE_PREFIX + key) || 'null');
    if(c && Date.now() - c.t < FUEL_CACHE_DAYS*86400000) return c.items;
  }catch(e){}
  return null;
}
function writeFuelCache(key, items){
  try{ localStorage.setItem(FUEL_CACHE_PREFIX + key, JSON.stringify({ t:Date.now(), items })); }
  catch(e){
    // plné úložiště - smažeme staré dlaždice benzínek a zkusíme to znovu
    try{
      Object.keys(localStorage).filter(k=>k.startsWith(FUEL_CACHE_PREFIX)).forEach(k=>localStorage.removeItem(k));
      localStorage.setItem(FUEL_CACHE_PREFIX + key, JSON.stringify({ t:Date.now(), items }));
    }catch(e2){}
  }
}
// jeden dotaz na obdélník dlaždic x0..x1 × y0..y1
async function fetchFuelBox(x0, y0, x1, y1){
  const s = y0*FUEL_TILE_DEG, w = x0*FUEL_TILE_DEG, n = (y1+1)*FUEL_TILE_DEG, e = (x1+1)*FUEL_TILE_DEG;
  const bbox = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
  const q = `[out:json][timeout:25];(node["amenity"="fuel"](${bbox});way["amenity"="fuel"](${bbox}););out center tags;`;
  let lastErr = null;
  for(const url of OVERPASS_URLS){
    try{
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:'data=' + encodeURIComponent(q) });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return (data.elements || []).map(el=>{
        const t = el.tags || {};
        const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
        const lon = el.lon != null ? el.lon : (el.center && el.center.lon);
        return { id: el.type + el.id, lat, lon, name: t.name || '', brand: t.brand || t.operator || '', hours: t.opening_hours || '' };
      }).filter(st=>st.lat != null && st.lon != null);
    }catch(err){ lastErr = err; }
  }
  throw lastErr || new Error('Overpass nedostupný');
}
async function pumpFuelQueue(){
  if(fuelBusy) return;
  fuelBusy = true;
  while(fuelQueue.length){
    // všechny čekající dlaždice najednou jedním dotazem (méně zátěže pro Overpass)
    const tiles = fuelQueue.splice(0, fuelQueue.length);
    const xs = tiles.map(t=>t[0]), ys = tiles.map(t=>t[1]);
    try{
      const items = await fetchFuelBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      const byTile = {};
      tiles.forEach(([x,y])=>{ byTile[fuelTileKey(x,y)] = []; });
      items.forEach(st=>{
        const k = fuelTileKey(Math.floor(st.lon/FUEL_TILE_DEG), Math.floor(st.lat/FUEL_TILE_DEG));
        if(byTile[k]) byTile[k].push(st);
      });
      Object.keys(byTile).forEach(k=>{ fuelTiles[k] = 'done'; writeFuelCache(k, byTile[k]); });
      if(fuelOn) addFuelStations(items);
    }catch(e){
      tiles.forEach(([x,y])=>{ delete fuelTiles[fuelTileKey(x,y)]; }); // zkusí se znovu při dalším posunu mapy
      if(!fuelErrorShown){ fuelErrorShown = true; toast('Benzínky se teď nepodařilo načíst (služba OpenStreetMap je přetížená nebo chybí signál).', 4500); }
    }
  }
  fuelBusy = false;
}
function updateFuel(){
  if(!map) return;
  if(!fuelLayer) fuelLayer = L.layerGroup();
  const visible = fuelOn && map.getZoom() >= FUEL_MIN_ZOOM;
  if(visible && !map.hasLayer(fuelLayer)) fuelLayer.addTo(map);
  if(!visible && map.hasLayer(fuelLayer)) map.removeLayer(fuelLayer);
  if(!visible) return;
  const b = map.getBounds();
  const x0 = Math.floor(b.getWest()/FUEL_TILE_DEG), x1 = Math.floor(b.getEast()/FUEL_TILE_DEG);
  const y0 = Math.floor(b.getSouth()/FUEL_TILE_DEG), y1 = Math.floor(b.getNorth()/FUEL_TILE_DEG);
  if((x1-x0+1)*(y1-y0+1) > 30) return; // pojistka (velmi široká obrazovka)
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){
    const key = fuelTileKey(x, y);
    if(fuelTiles[key]) continue;
    const cached = readFuelCache(key);
    if(cached){ fuelTiles[key] = 'done'; addFuelStations(cached); continue; }
    fuelTiles[key] = 'loading';
    fuelQueue.push([x, y]);
  }
  pumpFuelQueue();
}
function syncFuelBtn(){ if(fuelBtn) fuelBtn.classList.toggle('active', fuelOn); }
if(fuelBtn){
  syncFuelBtn();
  fuelBtn.addEventListener('click', ()=>{
    fuelOn = !fuelOn;
    try{ localStorage.setItem('fuelOn', fuelOn ? '1' : '0'); }catch(e){}
    syncFuelBtn();
    updateFuel();
    if(fuelOn && map && map.getZoom() < FUEL_MIN_ZOOM && !fuelHintShown){
      fuelHintShown = true;
      toast('Benzínky se ukážou po přiblížení mapy.');
    } else {
      toast(fuelOn ? 'Benzínky zobrazeny.' : 'Benzínky skryty.', 1800);
    }
  });
}
// ---------------------------------------------------------------
// Záznam jízdy
// - nahrává polohu z GPS (stejný odběr jako tlačítko polohy), ostatní trasy
//   zůstávají na mapě, takže jde zároveň jet podle některé z nich
// - body se průběžně ukládají v telefonu (localStorage), takže záznam
//   nezmizí ani po pádu/obnovení stránky
// - po Stop jde jízdu uložit do CendurOFF, stáhnout jako GPX nebo poslat
//   do plánovače k úpravě
// ---------------------------------------------------------------
const REC_STORAGE_KEY = 'cenduroff.recording';
const PLANNER_IMPORT_KEY = 'cenduroff.planner.import';
const REC_MIN_STEP_M = 5;          // nový bod nejdřív po tolika metrech (potlačí "chvění" na místě)
const REC_MAX_ACCURACY_M = 40;     // body s horší přesností zahodíme…
const REC_MAX_ACCURACY_LOOSE_M = 80; // …ale když dlouho nic nepřišlo, vezmeme i horší
const REC_LOOSE_AFTER_MS = 20000;
const REC_COLOR = '#9C27B0';

const rec = {
  state: 'idle',      // idle | recording | paused
  points: [],         // [lat, lon, ele|null, time(ms)]
  startedAt: null,
  elapsedMs: 0,       // čas z předchozích (už ukončených) úseků nahrávání
  runStart: null,     // kdy začal aktuální úsek nahrávání
  distM: 0,
  lastAcceptTs: 0
};
let recLine = null, recTimer = null, recSaveTimer = null, recHiddenAt = null, recPanelHidden = false;

const recBtn = document.getElementById('rec-btn');
const recBtnLabel = document.getElementById('rec-btn-label');
const recPanel = document.getElementById('rec-panel');
const rideOverlay = document.getElementById('ride-overlay');

function fmtDuration(ms){
  const t = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), sec = t%60;
  return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}
function recElapsed(){
  return rec.elapsedMs + (rec.state==='recording' && rec.runStart ? Date.now() - rec.runStart : 0);
}
function recPersist(){
  try{
    if(rec.state==='idle' && rec.points.length===0){ localStorage.removeItem(REC_STORAGE_KEY); return; }
    localStorage.setItem(REC_STORAGE_KEY, JSON.stringify({
      state: rec.state, points: rec.points, startedAt: rec.startedAt,
      elapsedMs: recElapsed(), distM: rec.distM
    }));
  }catch(e){ /* plné úložiště - záznam pořád běží v paměti */ }
}
// ukládání průběžně, ale ne při každém bodu (šetří baterii)
function recPersistSoon(){
  if(recSaveTimer) return;
  recSaveTimer = setTimeout(()=>{ recSaveTimer = null; recPersist(); }, 5000);
}
function ensureRecLine(){
  if(!map) return;
  if(!map.getPane('rec-track')) map.createPane('rec-track').style.zIndex = 445;
  if(!recLine){
    recLine = L.polyline(rec.points.map(p=>[p[0],p[1]]), { pane:'rec-track', color:REC_COLOR, weight:5, opacity:0.95, interactive:false }).addTo(map);
  }
}
function updateRecUi(){
  const active = rec.state !== 'idle';
  document.body.classList.toggle('recording', active);
  if(recBtn){
    recBtn.classList.toggle('rec-on', rec.state==='recording');
    recBtn.classList.toggle('rec-paused', rec.state==='paused');
  }
  if(recBtnLabel) recBtnLabel.textContent = rec.state==='recording' ? 'Nahrávám…' : rec.state==='paused' ? 'Pozastaveno' : 'Záznam jízdy';
  if(recPanel){
    recPanel.classList.toggle('open', active && !recPanelHidden);
    recPanel.classList.toggle('paused', rec.state==='paused');
  }
  const st = document.getElementById('rec-state');
  if(st) st.textContent = rec.state==='paused' ? 'Pozastaveno' : 'Nahrávám';
  const pauseBtn = document.getElementById('rec-pause');
  if(pauseBtn) pauseBtn.textContent = rec.state==='paused' ? 'Pokračovat' : 'Pauza';
  updateRecStats();
}
function updateRecStats(){
  const t = document.getElementById('rec-time');
  const d = document.getElementById('rec-dist');
  if(t) t.textContent = fmtDuration(recElapsed());
  if(d) d.textContent = (rec.distM/1000).toFixed(1).replace('.', ',');
}
function startRecTimer(){
  stopRecTimer();
  recTimer = setInterval(updateRecStats, 1000);
}
function stopRecTimer(){ if(recTimer){ clearInterval(recTimer); recTimer = null; } }

function recStart(){
  if(!startGpsWatch()) return;
  rec.state = 'recording';
  rec.points = [];
  rec.startedAt = Date.now();
  rec.elapsedMs = 0;
  rec.runStart = Date.now();
  rec.distM = 0;
  rec.lastAcceptTs = Date.now();
  recPanelHidden = false;
  if(recLine){ map.removeLayer(recLine); recLine = null; }
  ensureRecLine();
  requestWakeLock();
  startRecTimer();
  recPersist();
  updateRecUi();
  toast('Záznam spuštěn. Nech displej zapnutý – se zhasnutým displejem prohlížeč polohu nedostává.', 5000);
}
function recPause(){
  if(rec.state!=='recording') return;
  rec.elapsedMs = recElapsed();
  rec.runStart = null;
  rec.state = 'paused';
  stopRecTimer();
  recPersist();
  updateRecUi();
}
function recResume(){
  if(rec.state!=='paused') return;
  if(!startGpsWatch()) return;
  rec.state = 'recording';
  rec.runStart = Date.now();
  rec.lastAcceptTs = Date.now();
  ensureRecLine();
  requestWakeLock();
  startRecTimer();
  recPersist();
  updateRecUi();
}
function recClear(){
  rec.state = 'idle';
  rec.points = [];
  rec.startedAt = null;
  rec.elapsedMs = 0;
  rec.runStart = null;
  rec.distM = 0;
  stopRecTimer();
  if(recLine && map){ map.removeLayer(recLine); }
  recLine = null;
  try{ localStorage.removeItem(REC_STORAGE_KEY); }catch(e){}
  updateRecUi();
}

// voláno z onPosition() při každé nové GPS poloze
function recOnPosition(pos){
  const speedEl = document.getElementById('rec-speed');
  if(speedEl && rec.state!=='idle'){
    speedEl.textContent = (pos.coords.speed != null && !isNaN(pos.coords.speed)) ? Math.round(pos.coords.speed*3.6) : '–';
  }
  if(rec.state!=='recording') return;
  const now = pos.timestamp || Date.now();
  const acc = pos.coords.accuracy || 0;
  const loose = (now - rec.lastAcceptTs) > REC_LOOSE_AFTER_MS;
  if(acc > (loose ? REC_MAX_ACCURACY_LOOSE_M : REC_MAX_ACCURACY_M)) return;
  const alt = pos.coords.altitude;
  const pt = [
    Math.round(pos.coords.latitude*1e6)/1e6,
    Math.round(pos.coords.longitude*1e6)/1e6,
    (alt != null && !isNaN(alt)) ? Math.round(alt*10)/10 : null,
    now
  ];
  const last = rec.points[rec.points.length-1];
  if(last){
    const d = haversine(last, pt);
    if(d < REC_MIN_STEP_M) return;
    rec.distM += d;
  }
  rec.points.push(pt);
  rec.lastAcceptTs = now;
  ensureRecLine();
  if(recLine) recLine.addLatLng([pt[0], pt[1]]);
  updateRecStats();
  recPersistSoon();
}

function rideGainM(points){
  // převýšení z GPS výšky je "zubaté" - počítáme jen změny nad 3 m (jednoduchá hystereze)
  let gain = 0, ref = null;
  points.forEach(p=>{
    if(p[2]==null) return;
    if(ref==null){ ref = p[2]; return; }
    if(p[2] - ref >= 3){ gain += p[2]-ref; ref = p[2]; }
    else if(ref - p[2] >= 3){ ref = p[2]; }
  });
  return gain;
}
function defaultRideName(){
  const d = new Date(rec.startedAt || Date.now());
  return 'Jízda ' + d.getDate() + '.' + (d.getMonth()+1) + '.' + d.getFullYear() + ' ' +
    d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0');
}
function openRideDialog(){
  recPause();
  document.getElementById('ride-dist').textContent = (rec.distM/1000).toFixed(1).replace('.', ',');
  document.getElementById('ride-time').textContent = fmtDuration(recElapsed());
  document.getElementById('ride-gain').textContent = Math.round(rideGainM(rec.points));
  const nameEl = document.getElementById('ride-name');
  if(!nameEl.value) nameEl.value = defaultRideName();
  document.getElementById('ride-msg').textContent = rec.points.length < 2
    ? 'Záznam zatím nemá dost bodů (GPS ještě nezachytila pohyb).' : '';
  rideOverlay.classList.add('open');
}
function closeRideDialog(){ rideOverlay.classList.remove('open'); }
function resetRideForm(){
  document.getElementById('ride-name').value = '';
  document.getElementById('ride-desc').value = '';
  document.getElementById('ride-type').value = '';
  document.getElementById('ride-msg').textContent = '';
}

if(recBtn){
  recBtn.addEventListener('click', ()=>{
    if(rec.state==='idle'){ recStart(); return; }
    // během záznamu tlačítko jen schovává/ukazuje panel záznamu (ať nepřekáží mapě)
    recPanelHidden = !recPanelHidden;
    updateRecUi();
  });
  document.getElementById('rec-pause').addEventListener('click', ()=>{
    if(rec.state==='recording') recPause(); else recResume();
  });
  document.getElementById('rec-stop').addEventListener('click', openRideDialog);
  document.getElementById('ride-resume').addEventListener('click', ()=>{ closeRideDialog(); recResume(); });
  document.getElementById('ride-discard').addEventListener('click', ()=>{
    if(!confirm('Opravdu záznam jízdy zahodit? Tuto akci nejde vrátit zpět.')) return;
    closeRideDialog();
    resetRideForm();
    recClear();
    toast('Záznam zahozen.');
  });
  document.getElementById('ride-download').addEventListener('click', ()=>{
    if(rec.points.length < 2){ toast('Záznam zatím nemá dost bodů.'); return; }
    const name = document.getElementById('ride-name').value.trim() || defaultRideName();
    downloadGPX(rec.points, name);
  });
  document.getElementById('ride-planner').addEventListener('click', ()=>{
    if(rec.points.length < 2){ toast('Záznam zatím nemá dost bodů.'); return; }
    try{
      localStorage.setItem(PLANNER_IMPORT_KEY, JSON.stringify({
        name: document.getElementById('ride-name').value.trim() || defaultRideName(),
        description: document.getElementById('ride-desc').value.trim(),
        routeType: document.getElementById('ride-type').value || '',
        points: rec.points.map(p=>[p[0],p[1],p[2]])
      }));
    }catch(e){ toast('Záznam se nepodařilo předat plánovači (plné úložiště prohlížeče).'); return; }
    recClear();
    location.href = 'planovac.html?import=1';
  });
  document.getElementById('ride-save').addEventListener('click', async ()=>{
    const msg = document.getElementById('ride-msg');
    const name = document.getElementById('ride-name').value.trim();
    const description = document.getElementById('ride-desc').value.trim();
    const routeType = document.getElementById('ride-type').value;
    if(rec.points.length < 2){ msg.textContent = 'Záznam zatím nemá dost bodů.'; return; }
    if(!name){ msg.textContent = 'Zadejte název trasy.'; return; }
    if(!routeType){ msg.textContent = 'Vyberte typ trasy.'; return; }
    msg.textContent = 'Ukládám…';
    const btn = document.getElementById('ride-save');
    btn.disabled = true;
    try{
      const route = await api('/api/routes', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, description, routeType, points: rec.points.map(p=>[p[0],p[1],p[2]]) })
      });
      closeRideDialog();
      resetRideForm();
      recClear();
      toast('Jízda byla uložena do CendurOFF.');
      await loadRoutes();
      openDetail(route.id);
    }catch(e){
      // záznam zůstává uložený v telefonu - jde to zkusit znovu (např. až bude signál)
      msg.textContent = (e.message || 'Trasu se nepodařilo uložit.') + ' Záznam zůstává v telefonu, zkus to znovu.';
    }finally{
      btn.disabled = false;
    }
  });
}

// obnoví nedokončený záznam (po obnovení stránky, pádu prohlížeče…) - vždy jako pozastavený,
// ať se nic nenahrává bez vědomí jezdce
function restoreRecording(){
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem(REC_STORAGE_KEY) || 'null'); }catch(e){}
  if(!saved || !Array.isArray(saved.points) || (saved.state==='idle' && !saved.points.length)) return;
  rec.points = saved.points;
  rec.startedAt = saved.startedAt || Date.now();
  rec.elapsedMs = saved.elapsedMs || 0;
  rec.distM = saved.distM || 0;
  rec.runStart = null;
  rec.state = 'paused';
  ensureRecLine();
  recPersist();
  updateRecUi();
  toast('Máš nedokončený záznam jízdy – můžeš pokračovat, nebo ho uložit tlačítkem Stop.', 6000);
}

document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden'){
    recHiddenAt = Date.now();
    if(rec.state!=='idle') recPersist();
  } else if(rec.state==='recording' && recHiddenAt && Date.now() - recHiddenAt > 20000){
    toast('Pozor: se zhasnutým displejem nebo v jiné aplikaci se poloha nemusela zaznamenávat.', 5000);
  }
});
window.addEventListener('pagehide', ()=>{ if(rec.state!=='idle') recPersist(); });
window.addEventListener('beforeunload', (e)=>{
  if(rec.state==='recording'){
    recPersist();
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
async function enterApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-screen').style.display='flex';
  document.getElementById('user-chip').textContent = currentUser.displayName + (isAdminUser() ? ' · admin' : '');
  initMap();
  setTimeout(()=>map.invalidateSize(), 50);
  if(!enterApp._fuelBound){
    enterApp._fuelBound = true;
    map.on('moveend', updateFuel);
    setTimeout(updateFuel, 400);
  }
  positionFloatingMapButtons();
  setTimeout(positionFloatingMapButtons, 100);
  await loadRoutes();
  requestWakeLock();
  if(rec.state==='idle') restoreRecording();
  if(pendingLinkId){
    const linked = pendingLinkId;
    pendingLinkId = null;
    if(routesCache[linked]){
      const layer = layersById[linked];
      if(layer) map.fitBounds(layer.getBounds(), {maxZoom:14});
      openDetail(linked);
    } else {
      setUrlRoute(null);
      toast('Trasa z odkazu už neexistuje.', 5000);
    }
  }
}

(async function boot(){
  try{
    const user = await api('/api/auth/me');
    currentUser = user;
    if(goNextIfAny()) return;
    enterApp();
  }catch(e){
    // not logged in - show login screen (already visible by default)
  }
})();

})();
