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
            <button class="ghost-btn" id="ride-planner" type="button">✏️ Upravit v Atlas Planneru</button>
          </div>
          <div class="ride-row">
            <button class="ghost-btn" id="ride-resume" type="button">Pokračovat v záznamu</button>
            <button class="ghost-btn ride-discard" id="ride-discard" type="button">Zahodit záznam</button>
          </div>
        </div>
      </div>`);
  }
  // benzínky: od v1.48 jsou přepínač v nabídce 🗺 (podkladová mapa), ne samostatné tlačítko
  // jízdní režim (v1.46): tlačítko ☰ a sbalení panelu záznamu
  if(!document.getElementById('menu-btn')){
    const fb = document.getElementById('satellite-btn');
    if(fb) fb.insertAdjacentHTML('beforebegin', `<button class="map-btn map-btn-square" id="menu-btn" type="button" title="Menu" aria-label="Zobrazit / skrýt menu" aria-expanded="false">☰</button>`);
  }
  if(!document.getElementById('rec-toggle')){
    const rp = document.getElementById('rec-panel');
    if(rp) rp.insertAdjacentHTML('beforeend', `<button class="rec-toggle" id="rec-toggle" type="button" aria-label="Sbalit / rozbalit panel záznamu" aria-expanded="true">▾</button>`);
  }
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
  if(!requireLogin('stažení GPX')) return;
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
  return (n && /^(planovac|merch|faq|admin|nastaveni|roadbook-planner|roadbook-navi)\.html(\?[^#]*)?$/.test(n)) ? n : null;
}
// ---------------------------------------------------------------
// v4.2: Atlas bez přihlášení – host vidí mapu a trasy; navigace, záznam jízdy, nahrávání,
// stažení GPX a hodnocení vyžadují přihlášení (requireLogin otevře přihlášení nad mapou)
// ---------------------------------------------------------------
let appEntered = false;
// v4.14: stavy roadbooků všech tras (ready / check / draft; chybí = bez roadbooku)
let rbStatesP = null, rbStatesAt = 0;
function roadbookStates(){
  if(rbStatesP && Date.now() - rbStatesAt < 5 * 60000) return rbStatesP;
  rbStatesAt = Date.now();
  rbStatesP = fetch(API_URL + '/api/roadbooks').then(r => r.ok ? r.json() : []).then(list => {
    const m = {};
    (Array.isArray(list) ? list : []).forEach(x => {
      m[x.route_id] = x.state || (x.stale ? 'check' : x.status === 'ready' ? 'ready' : 'draft');
    });
    return m;
  }).catch(() => { rbStatesP = null; return {}; });
  return rbStatesP;
}
function requireLogin(what){
  if(currentUser) return true;
  // v4.3.1: nejdřív malé okno s křížkem (stejné jako v Roadbook NAVI), přihlášení až na „Přihlásit se“
  const nav = what === 'navigaci';
  if(window.CendurHeader && window.CendurHeader.ask){
    window.CendurHeader.ask({
      title: nav ? 'Navigace je pro přihlášené' : 'Jen pro přihlášené',
      msg: 'Tato funkce je k dispozici jen pro přihlášené členy.',
      yes: { label: 'Přihlásit se', fn: () => showLoginOverlay(what) }
    });
  } else showLoginOverlay(what);
  return false;
}
function showLoginOverlay(what){
  const ls = document.getElementById('login-screen');
  const why = document.getElementById('login-why');
  if(why){ why.textContent = what ? 'Pro ' + what + ' se přihlas.' : ''; why.hidden = !what; }
  ls.style.display = 'flex';
}
function hideLoginOverlay(){
  document.getElementById('login-screen').style.display = 'none';
  // přišel jsem na přihlášení z jiné stránky (?next / ?login) → pokračovat v Atlasu bez účtu
  if(!appEntered){
    try{ history.replaceState(null, '', 'index.html?atlas=1'); }catch(e){}
    enterApp();
  }
}
document.getElementById('login-close').addEventListener('click', hideLoginOverlay);
window.CendurLogin = what => showLoginOverlay(what);   // pro header (Přihlásit se / dlaždice)
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
const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app'; // prázdná/chybějící adresa = Railway

// přihlašovací token uložený v prohlížeči – posílá se v hlavičce Authorization, takže přihlášení
// funguje i tam, kde prohlížeč blokuje cookies serveru (anonymní okno, Safari na iPhonu)
const TOKEN_KEY = 'cenduroff.token';
function getToken(){ try{ return localStorage.getItem(TOKEN_KEY); }catch(e){ return null; } }
function setToken(t){ try{ if(t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }catch(e){} }
function withAuth(options){
  const o = Object.assign({ credentials:'include' }, options);
  const t = getToken();
  if(t) o.headers = Object.assign({}, o.headers, { Authorization: 'Bearer ' + t });
  return o;
}
async function api(url, options){
  // v4.2: host (nepřihlášený) smí jen číst – jakýkoli zápis nabídne přihlášení
  const method = ((options && options.method) || 'GET').toUpperCase();
  if(method !== 'GET' && !currentUser && !url.startsWith('/api/auth/')){
    requireLogin('hodnocení, recenze, fotky a ukládání');
    const err = new Error('Pro tohle se musíš přihlásit.'); err.needsLogin = true; throw err;
  }
  // Automaticky připojí adresu backendu z Railway ke všem voláním
  const fullUrl = url.startsWith('http') ? url : API_URL + url;
  // v4.7.1: když se nepodaří spojit se serverem (výpadek signálu, server se zrovna restartuje),
  // přihlášení / registraci zkusíme ještě jednou a pak ukážeme srozumitelnou hlášku
  let res;
  try{ res = await fetch(fullUrl, withAuth(options)); }
  catch(e){
    if(url.startsWith('/api/auth/')){
      await new Promise(r => setTimeout(r, 2500));
      try{ res = await fetch(fullUrl, withAuth(options)); }catch(e2){ e = e2; }
    }
    if(!res){
      const err = new Error('Nepodařilo se spojit se serverem CendurOFF. Zkontroluj připojení k internetu a zkus to za minutu znovu.');
      err.network = true; throw err;
    }
  }
  let data = null, isJson = false;
  try{ data = await res.json(); isJson = true; }catch(e){}
  if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
  if(!isJson) throw new Error('Server neodpověděl správně (zkus to prosím za chvíli).');
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

// v4.9: registrace = e-mail (přihlašovací jméno) + přezdívka (zobrazované jméno) + heslo;
// přihlášení e-mailem – starší účty se dál přihlašují svým uživatelským jménem
const liUserLabel = document.getElementById('li-user-label');
const liUser = document.getElementById('li-user');
const liNickWrap = document.getElementById('li-nick-wrap');
const liNick = document.getElementById('li-nick');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function setLoginMode(m){
  mode = m;
  const reg = m === 'register';
  tabRegister.classList.toggle('active', reg); tabLogin.classList.toggle('active', !reg);
  loginSubmit.textContent = reg ? 'Vytvořit účet' : 'Přihlásit se';
  liUserLabel.textContent = reg ? 'E-mail' : 'E-mail (nebo dřívější uživatelské jméno)';
  liUser.type = reg ? 'email' : 'text';
  liUser.autocomplete = reg ? 'email' : 'username';
  liNickWrap.hidden = !reg; liNick.required = reg;
  document.getElementById('li-pass').autocomplete = reg ? 'new-password' : 'current-password';
  formMsg.textContent = '';
}
tabLogin.addEventListener('click', ()=> setLoginMode('login'));
tabRegister.addEventListener('click', ()=> setLoginMode('register'));
setLoginMode('login');

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const usernameRaw = document.getElementById('li-user').value.trim();
  const username = usernameRaw.toLowerCase();
  const pass = document.getElementById('li-pass').value;
  const nick = liNick.value.trim().replace(/\s+/g, ' ');
  if(!username || !pass){ formMsg.textContent = mode==='register' ? 'Vyplň e-mail, přezdívku a heslo.' : 'Vyplň e-mail a heslo.'; return; }
  if(mode==='register'){
    if(!EMAIL_RE.test(username)){ formMsg.textContent='Zadej platný e-mail – bude to tvoje přihlašovací jméno.'; return; }
    if(nick.length < 2){ formMsg.textContent='Zadej přezdívku (aspoň 2 znaky) – pod ní tě uvidí ostatní.'; return; }
    if(pass.length < 4){ formMsg.textContent='Heslo musí mít aspoň 4 znaky.'; return; }
  }
  formMsg.textContent='';
  formMsg.style.color='';
  loginSubmit.disabled = true;
  try{
    const endpoint = mode==='register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode==='register'
      ? { username, password: pass, displayName: nick, email: true }
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
    if(user.token){ setToken(user.token); delete user.token; }
    currentUser = user;
    if(goNextIfAny()) return;
    // přihlášení z prohlížení bez účtu → stránku načíst znovu už přihlášený (trasy s oprávněními)
    if(appEntered){
      try{ const u = new URL(location.href); u.searchParams.delete('login'); history.replaceState(null, '', u); }catch(e){}
      location.reload(); return;
    }
    enterApp();
  }catch(err){
    formMsg.textContent = err.message || 'Něco se nepovedlo, zkuste to prosím znovu.';
  }finally{
    loginSubmit.disabled = false;
  }
});


// ---------------------------------------------------------------
// Map + routes
// ---------------------------------------------------------------
let map, activeRouteId=null;
const layersById = {};
let routesCache = {};
// v3.8: podkladové mapy – turistická Mapy.com a satelit (public/basemaps.js), tlačítko je přepíná
let baseCtl = null;

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
// v3.9: v jízdním režimu (mobil) zakrývá seznam / detail trasy skoro celou mapu – dokud je otevřený,
// mapa se pod ním neotáčí (na starších telefonech, např. Huawei P20, to přes panel problikávalo)
function panelCoversMap(){
  return document.body.classList.contains('ride-ui') &&
    (!routeListEl.classList.contains('collapsed') || detailPanelEl.classList.contains('open'));
}
function panelsChanged(){
  if(typeof headingMode !== 'undefined' && headingMode === 'heading' && !panelCoversMap() && map) setMapRotation(true);
}
new MutationObserver(panelsChanged).observe(routeListEl, { attributes:true, attributeFilter:['class'] });
new MutationObserver(panelsChanged).observe(detailPanelEl, { attributes:true, attributeFilter:['class'] });
// v3.9: jazýček reaguje už na zvednutí prstu (spolehlivější v rukavicích / na starších telefonech)
function onTap(el, fn){ window.CendurZoom.tap(el, fn); }   // společné klepnutí (public/zoom.js)
// v jízdním režimu zavře otevřený seznam / detail i klepnutí do mapy vedle panelu
document.getElementById('map').parentElement.addEventListener('pointerdown', e=>{
  if(!document.body.classList.contains('ride-ui')) return;
  if(e.target.closest('#route-list, #detail-panel, #selection-bar, .map-btn')) return;
  if(!routeListEl.classList.contains('collapsed') && !routeListEl.classList.contains('selecting')){
    routeListEl.classList.add('collapsed');
    e.stopPropagation();
  }
}, true);
onTap(routeListTab, ()=>{
  const opening = routeListEl.classList.contains('collapsed');
  routeListEl.classList.toggle('collapsed');
  localStorage.setItem('routeListCollapsed', routeListEl.classList.contains('collapsed') ? '1' : '0');
  // na mobilu se oba panely (seznam tras × detail trasy) kvůli šířce nevejdou vedle sebe,
  // proto se navzájem vylučují - otevření jednoho zavře ten druhý
  if(opening && isMobileViewport() && detailPanelEl.classList.contains('open')) closeDetail();
});
// detail trasy se zavírá jazýčkem se šipkou (nahrazuje dřívější křížek)
onTap(document.getElementById('detail-panel-tab'), closeDetail);
window.addEventListener('resize', syncMobilePanelTabs);

// okna „O projektu“ a „Můj účet“ (změna hesla, odhlášení) obsluhuje společná hlavička – public/header.js

function initMap(){
  if(map) return;
  map = L.map('map', { zoomControl:false }).setView([49.8711, 17.8756], 11); // výchozí pohled: Hradec nad Moravicí
  baseCtl = window.CendurMaps.attach(map, { toast: t => toast(t, 1800) });
  baseCtl.bindButton(document.getElementById('satellite-btn'), openLayerMenu);
  baseCtl.renderMenu(document.getElementById('layer-menu'));
  // samostatná vrstva pro každý typ trasy: offroad dole, cenduro nad ním, transportní
  // nahoře; úplně navrch právě vybraná (modrá) trasa
  ROUTE_TYPE_ORDER.forEach(t=>{ map.createPane('route-' + t).style.zIndex = ROUTE_TYPES[t].z; });
  map.createPane(SELECTED_PANE).style.zIndex = 440;
  // volná jízda: klepnutí do prázdné mapy pustí vybranou trasu
  map.on('click', ()=>{ if(navOn && freePickedId != null && Date.now() - freeRouteClickTs > 300) freePick(null); });
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
    if(window.CendurRides) window.CendurRides.setRoutes(routes);   // v2.5: počítání projetí tras
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

// Tloušťka čar: při sledování polohy (jízda) výrazně silnější, ať jsou trasy na displeji
// za jízdy dobře vidět; při prohlížení mapy normální, ať nezakrývají cesty pod sebou.
let navOn = false;
const ROUTE_WEIGHT = { normal:4, selected:6, rec:5 };
const ROUTE_WEIGHT_NAV = { normal:8, selected:10, rec:9 };
function routeWeight(kind){ return (navOn ? ROUTE_WEIGHT_NAV : ROUTE_WEIGHT)[kind]; }
function selectedStyle(){ return { color:ROUTE_COLOR_SELECTED, weight:routeWeight('selected'), opacity:1 }; }
const STYLE_HOVER = { color:ROUTE_COLOR_HOVER, weight:6, opacity:1 };
const ROUTE_CASING = 4;   // v3.2: o kolik px je bílé obtažení širší než trasa
function normalStyle(id){
  return { color: typeInfo(routesCache[id]).color, weight:routeWeight('normal'), opacity: navOn ? 1 : 0.9 };
}

// Je trasa "modrá"? Buď je otevřená v detailu, nebo je zaškrtnutá ve výběru více tras.
function isRouteMarked(id){
  if(navOn && !selectMode && freeActiveId() != null) return Number(id) === Number(freeActiveId());
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
    layer.setStyle(selectedStyle());
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
  const line = L.polyline(latlngs, Object.assign({ pane:'route-' + typeOf(route) }, normalStyle(route.id)));
  // v3.2: bílé obtažení trasy (jako v Roadbook NAVI) – samostatná čára pod barevnou,
  // vždy ve stejné vrstvě jako trasa, sleduje její viditelnost i tloušťku
  const casing = L.polyline(latlngs, { pane: line.options.pane, color:'#fff', weight: line.options.weight + ROUTE_CASING, opacity: 0.9, interactive:false });
  line.on('add', ()=>{
    if(map.hasLayer(casing)) map.removeLayer(casing);
    casing.options.pane = line.options.pane;
    casing.addTo(map);
    line.bringToFront();
  });
  line.on('remove', ()=>{ if(map.hasLayer(casing)) map.removeLayer(casing); });
  const setStyle0 = line.setStyle.bind(line);
  line.setStyle = st=>{
    setStyle0(st);
    if(st && st.weight != null) casing.setStyle({ weight: st.weight + ROUTE_CASING });
    return line;
  };
  line.addTo(map);
  line.bindTooltip(routeTipHtml(route), { sticky:true, className:'trail-tip' });
  // v4.15.2: při navigaci se štítek s názvem trasy neukazuje (na otočené mapě by zůstal viset bokem)
  line.on('tooltipopen', ()=>{ if(navOn) line.closeTooltip(); });
  line.on('mouseover', ()=>{ if(!isRouteMarked(route.id)) line.setStyle(STYLE_HOVER); });
  line.on('mouseout', ()=> applyRouteStyle(route.id));
  line.on('click', ()=>{
    if(selectMode) toggleSelected(route.id);
    else if(navOn){ freeRouteClickTs = Date.now(); freePick(freePickedId === route.id ? null : route.id); }
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
// v2.5: statistika projetí trasy v detailu (jen admin)
async function loadAdminStats(routeId){
  const box = document.getElementById('admin-stats');
  if(!box) return;
  try{
    const st = await api('/api/admin/stats/' + routeId);
    if(activeRouteId !== routeId || !document.getElementById('admin-stats')) return;
    const who = (st.riders_list || []).map(u => `<li><b>${escapeHtml(u.display_name)}</b> – ${u.rides}× <span class="hint">(30 dní: ${u.rides_30d}×, naposledy ${new Date(u.last_ride).toLocaleDateString('cs-CZ')})</span></li>`).join('');
    box.innerHTML = `<h3>Projetí trasy <span class="admin-tag">admin</span></h3>
      <div class="detail-stats">
        <div class="stat"><b>${st.rides_30d}</b><span>za 30 dní</span></div>
        <div class="stat"><b>${st.rides_total}</b><span>celkem</span></div>
        <div class="stat"><b>${st.riders}</b><span>jezdců</span></div>
      </div>
      ${who ? `<details class="admin-riders"><summary>Kdo trasu projel</summary><ul>${who}</ul></details>` : '<p class="hint">Zatím ji nikdo neprojel (počítá se ≥ 20 % trasy při navigaci nebo záznamu jízdy).</p>'}`;
  }catch(err){
    box.innerHTML = '<h3>Projetí trasy <span class="admin-tag">admin</span></h3><p class="hint">Statistiku se nepodařilo načíst.</p>';
  }
}

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
        ${isOwner || (currentUser && p.user_id === currentUser.id) ? `<button class="delete-photo-btn" data-photo="${p.id}" title="Smazat fotku">×</button>` : ''}
        ${p.user_id && p.user_id !== route.owner_id && p.user_display ? `<span class="photo-by">📷 ${escapeHtml(p.user_display)}</span>` : ''}
        ${isOwner && !p.is_main ? `<button class="set-main-btn" data-photo="${p.id}">Nastavit jako hlavní</button>` : ''}
      </div>`;
  }).join('');

  inner.innerHTML = `
    <h2>${escapeHtml(route.name)}</h2>
    <div class="detail-chips"><div class="type-chip">${typeDot(typeOf(route))}${typeInfo(route).label} trasa</div><a class="rb-chip" id="detail-rb" hidden></a></div>
    <div class="detail-go one" id="detail-go">
      <button type="button" class="go-atlas" id="detail-go-atlas">▶ <span class="t">Navigovat<small>Atlas NAVI</small></span></button>
      <a class="go-rb" id="detail-go-rb" hidden>📒 <span class="t">Roadbook<small>Roadbook NAVI</small></span></a>
    </div>
    <div class="detail-owner">Přidal(a) ${escapeHtml(route.owner_display)} · ${fmtDate(route.created_at)}${route.gpx_updated_at ? `<br>GPX aktualizováno dne: ${fmtDateShort(route.gpx_updated_at)}` : ''}</div>
    ${route.description ? `<div class="detail-desc" id="detail-desc-text">${escapeHtml(route.description)}${route.description_by && route.description_by !== route.owner_id && route.description_by_display ? `<div class="desc-by">Popis doplnil(a) ${escapeHtml(route.description_by_display)}</div>` : ''}</div>` : ''}
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
        ${isAdminUser() ? `<label for="edit-route-owner">Vlastník trasy <span class="admin-tag">admin</span></label>
        <select id="edit-route-owner"><option value="${route.owner_id}">${escapeHtml(route.owner_display)}</option></select>` : ''}
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
      ${isOwner ? `<a class="ghost-btn planner-link" href="planovac.html?trasa=${route.id}">✏️ Upravit v Atlas Planneru</a>` : ''}
    </div>
    ${currentUser && currentUser.role === 'admin' ? '<div class="admin-stats" id="admin-stats"><h3>Projetí trasy <span class="admin-tag">admin</span></h3><p class="hint">Načítám…</p></div>' : ''}
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
    ${currentUser && !isOwner && (photos.length < 3 || !route.description || route.description_by === currentUser.id) ? `
      <div class="owner-controls contrib-controls">
        <h3>Doplnit trasu</h3>
        <p class="hint">Chybí trase fotky nebo popis? Můžeš je doplnit. Autor trasy (${escapeHtml(route.owner_display)}) je pořád nadřazený – může je kdykoli vyměnit nebo smazat.</p>
        ${photos.length < 3 ? `<label class="contrib-label" for="photo-input">Přidat fotku (zbývá ${3 - photos.length} z 3)</label>
        <input type="file" id="photo-input" accept="image/*">` : ''}
        ${!route.description || route.description_by === currentUser.id ? `<label class="contrib-label" for="contrib-desc">${route.description ? 'Upravit tvůj popis' : 'Napsat popis trasy'}</label>
        <textarea id="contrib-desc" maxlength="5000" placeholder="Jaká je trasa, povrch, obtížnost, na co si dát pozor…">${escapeHtml(route.description || '')}</textarea>
        <button class="primary-btn" id="contrib-desc-save" type="button">Uložit popis</button>` : ''}
      </div>` : ''}
  `;
  // v4.14: stav roadbooku (seznam stavů se načte jednou a drží 5 minut); klepnutím do Roadbook NAVI
  roadbookStates().then(map => {
    const el = inner.querySelector('#detail-rb');
    if(!el || !el.isConnected) return;
    const st = map[route.id] || 'auto';
    const T = { ready:'Roadbook ready', check:'Roadbook ke kontrole', draft:'Roadbook rozpracovaný', auto:'Bez roadbooku' };
    el.className = 'rb-chip rb-' + st;
    el.innerHTML = '<i></i>' + T[st] + (st === 'auto' ? '' : ' ›');
    if(st !== 'auto'){ el.href = 'roadbook-navi.html?trasa=' + encodeURIComponent(route.id); el.title = 'Otevřít v Roadbook NAVI'; }
    else el.removeAttribute('href');
    el.hidden = false;
    // v4.15: velké tlačítko Roadbook jen u trasy s roadbookem
    const gr = inner.querySelector('#detail-go-rb');
    if(gr && st !== 'auto'){
      gr.href = 'roadbook-navi.html?trasa=' + encodeURIComponent(route.id) + (currentUser ? '&jed=1' : '');
      gr.hidden = false; inner.querySelector('#detail-go').classList.remove('one');
    }
  }).catch(() => {});
  // v4.15: ▶ Navigovat – Atlas NAVI rovnou po téhle trase
  inner.querySelector('#detail-go-atlas').addEventListener('click', () => {
    if(!currentUser){ requireLogin('navigaci'); return; }
    if(window.CendurSound) CendurSound.unlock();
    const rid = route.id;
    closeDetail();
    if(!navOn) setNavMode(true);
    if(navOn){ freeAsked.add(rid); freePick(rid); }
  });
  // v4.3: odznak a motorka autora trasy (veřejný profil jezdce)
  if(route.owner_id && window.CendurRider){
    fetch(API_URL + '/api/riders/' + encodeURIComponent(route.owner_id)).then(r => r.ok ? r.json() : null).then(p => {
      const el = inner.querySelector('.detail-owner');
      if(!p || !el || !el.isConnected) return;
      const b = window.CendurRider.badgeFor(p.km);
      const d = document.createElement('div');
      d.className = 'owner-rider';
      // v4.4: hodnost + získané sběratelské odznaky (ikony, název v title)
      const got = (window.CendurRider.achievements ? window.CendurRider.achievements(p.stats, p.earned) : []).filter(a => a.got);
      d.innerHTML = '<span class="owner-badge" title="' + escapeHtml(b.name + ' – najeto ' + window.CendurRider.fmtKm(p.km)) + '">' + b.icon + ' ' + escapeHtml(b.name) + '</span>' +
        (got.length ? '<span class="owner-ach">' + got.map(a => '<span title="' + escapeHtml(a.name + ' – ' + a.desc) + '">' + a.icon + '</span>').join('') + '</span>' : '') +
        (p.bike ? '<span class="owner-bike">🏍 ' + escapeHtml(p.bike) + '</span>' : '');
      el.appendChild(d);
    }).catch(() => {});
  }

  document.getElementById('download-gpx-btn').addEventListener('click', ()=> downloadGPX(route.points, route.name));
  if(currentUser && currentUser.role === 'admin') loadAdminStats(route.id);
  document.getElementById('share-route-btn').addEventListener('click', ()=> shareRoute(route));
  bindRating(route);
  bindReviews(route.id, reviews);
  inner.querySelectorAll('.photo-thumb').forEach(img=>{
    img.addEventListener('click', ()=> openLightbox(photos.map(p=>p.data_url), Number(img.dataset.index), route.name));
  });

  // v4.5: mazání fotek a nahrávání – vlastník/admin, a ostatní členové při doplňování trasy
  {
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
    const cd = document.getElementById('contrib-desc-save');
    if(cd) cd.addEventListener('click', async ()=>{
      try{
        await api(`/api/routes/${id}/description`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ description: document.getElementById('contrib-desc').value }) });
        toast('Popis uložen. Díky!');
        await loadRoutes();
        openDetail(id);
      }catch(e){ toast(e.message || 'Popis se nepodařilo uložit.'); }
    });
  }

  if(isOwner){
    const editForm = document.getElementById('edit-route-form');
    const editBtn = document.getElementById('edit-route-btn');
    // v4.5.3: admin – výběr vlastníka trasy (seznam schválených uživatelů se načte při otevření úprav)
    const ownerSel = document.getElementById('edit-route-owner');
    let ownersLoaded = false;
    function loadOwners(){
      if(!ownerSel || ownersLoaded) return;
      ownersLoaded = true;
      api('/api/admin/users').then(list => {
        ownerSel.innerHTML = list.filter(u => u.is_approved).sort((a, b) => a.display_name.localeCompare(b.display_name, 'cs'))
          .map(u => `<option value="${u.id}"${u.id === route.owner_id ? ' selected' : ''}>${escapeHtml(u.display_name)} (${escapeHtml(u.username)})</option>`).join('');
      }).catch(() => { ownersLoaded = false; });
    }
    editBtn.addEventListener('click', ()=>{
      loadOwners();
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
        if(ownerSel && Number(ownerSel.value) !== route.owner_id){
          const x = await api(`/api/admin/routes/${id}/owner`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ownerId: Number(ownerSel.value) }) });
          toast('Trasa upravena – nový vlastník: ' + x.owner_display);
        } else
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
    const deleteRouteBtn = document.getElementById('delete-route-btn');
    if(deleteRouteBtn){
      deleteRouteBtn.addEventListener('click', async ()=>{
        if(!confirm('Opravdu chceš smazat trasu "'+route.name+'"?')) return;
        try{
          await api(`/api/routes/${id}`, { method:'DELETE' });
          toast('Trasa byla smazána.');
          closeDetail();
          await loadRoutes();
        }catch(e){ toast(e.message || 'Trasu se nepodařilo smazat.'); }
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
// v4.3.3: tlačítko vytváří header.js – když se nenačte (např. robot Googlu), Atlas nesmí spadnout
document.getElementById('open-upload')?.addEventListener('click', ()=>{
  if(!requireLogin('nahrání trasy')) return;
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
const HEADING_UPDATE_THRESHOLD_DEG_COMPASS = 15;  // kompas: vyšší práh, ať drobné chvění v klidu vůbec neprojde
const HEADING_MIN_UPDATE_MS_GPS = 120;           // GPS: přepočet natočení max ~8x/s
const HEADING_MIN_UPDATE_MS_COMPASS = 280;       // kompas: přepočet pomalejší, max ~3-4x/s
// poloha šipky na obrazovce při sledování (0 = nahoře, 1 = dole): na výšku 80 %, na šířku
// (nízký displej) 75 % – ať je před šipkou vidět co nejvíc trasy
const FOLLOW_MARKER_Y_PORTRAIT = 0.80;
const FOLLOW_MARKER_Y_LANDSCAPE = 0.75;
function followMarkerFraction(){ return window.innerWidth > window.innerHeight ? FOLLOW_MARKER_Y_LANDSCAPE : FOLLOW_MARKER_Y_PORTRAIT; }

// Vycentruje mapu tak, aby se GPS bod nezobrazil uprostřed obrazovky, ale
// v dolní třetině (FOLLOW_MARKER_Y_FRACTION) - ať je vidět víc mapy před sebou.
// Posun se počítá ve směru aktuálního natočení mapy (v režimu "směr jízdy" tedy
// ve směru jízdy), takže funguje správně i po otočení/zvětšení mapy.
function setFollowView(latlng, animate){
  const z = map.getZoom();
  // V režimu "směr jízdy" je #map čtverec vystředěný přímo na místo šipky (viz layoutMapForMode),
  // takže GPS bod stačí dát doprostřed mapy - leží pak přesně ve středu otáčení a při
  // natočení mapy zůstává na místě (žádné "excentrické" houpnutí a dojíždění).
  if(headingMode==='heading'){
    map.setView(latlng, z, { animate: !!animate });
    return;
  }
  // výška viditelné části mapy (v režimu "směr jízdy" je samotný #map větší než obrazovka)
  const visibleH = mapEl.parentElement.clientHeight;
  const theta = (headingMode==='heading') ? displayedHeading * Math.PI/180 : 0;
  const k = (followMarkerFraction() - 0.5) * visibleH;
  const targetPx = map.project(latlng, z);
  const dx = Math.sin(theta) * k;
  const dy = Math.cos(theta) * k;
  const center = map.unproject(L.point(targetPx.x + dx, targetPx.y - dy), z);
  map.setView(center, z, { animate: !!animate });
}

let smoothedHeading = 0;      // úhel po nízkopásmovém filtru
let displayedHeading = 0;     // úhel skutečně vykreslený (po prahování/limitu reakce)
// v3.9.1: úhel, o který je otočená MAPA. Normálně = displayedHeading; při ručním posouvání
// mapy v navigaci zamrzne (mapa se přestane otáčet), šipka dál ukazuje skutečný směr jízdy.
let mapRotDeg = 0;
let headingInitialized = false;
let lastHeadingUpdateTs = 0;
let currentSpeedKmh = 0;

const locateBtn = document.getElementById('locate-btn');
const locateBtnLabel = document.getElementById('locate-btn-label');
const mapEl = document.getElementById('map');

// v3.6: přibližování přes společnou funkci (public/zoom.js); při sledování polohy se šipka
// po změně hned vrátí na své místo (i na otočené / nakloněné mapě)
function zoomOpts(){
  // při ručním prohlížení (gesta v navigaci) se přibližuje kolem středu, na polohu se mapa vrátí sama
  return { min:3, max:19, after: (followMode && lastLatLng && !navManualActive()) ? ()=> setFollowView(shownLatLng || lastLatLng, false) : null };
}

// Fullscreen + satelitní tlačítko jsou (kvůli overflow:hidden na main.mapwrap)
// mimo mapu, přímo v #app-screen - jejich "top" proto dopočítáváme podle reálné
// výšky hlavičky (ta se na mobilu může zalomit na 2 řádky a mění výšku podle
// obsahu), ať tlačítka nikdy nepřekrývají tlačítka v hlavičce.
function positionFloatingMapButtons(){
  // spodní hrana hlavičky -> CSS proměnné, ze kterých si tlačítka nad mapou počítají polohu
  // (--hdr-bottom pro běžné rozložení, --top-offset pro jízdní režim: 0, když je hlavička schovaná)
  const header = document.querySelector('header.topbar');
  const visible = header && header.offsetParent !== null && header.getBoundingClientRect().height > 0;
  const bottom = visible ? Math.round(header.getBoundingClientRect().bottom) : 0;
  const root = document.documentElement.style;
  root.setProperty('--hdr-bottom', bottom + 'px');
  root.setProperty('--top-offset', bottom + 'px');
  ['satellite-btn','fullscreen-btn'].forEach(id=>{ const el = document.getElementById(id); if(el) el.style.top = ''; });
}
window.addEventListener('resize', positionFloatingMapButtons);
window.addEventListener('load', positionFloatingMapButtons);
positionFloatingMapButtons();
setTimeout(positionFloatingMapButtons, 300);
// hlavička mění výšku i po načtení (písmo, jméno uživatele, zalomení) -> sledovat ji
if('ResizeObserver' in window){
  const hdr = document.querySelector('header.topbar');
  if(hdr) new ResizeObserver(()=>positionFloatingMapButtons()).observe(hdr);
}

// ---------------------------------------------------------------
// Jízdní režim (mobil na výšku a nízké displeje na šířku):
// tlačítka ve sloupcích u okrajů, hlavička a seznam tras schované za tlačítkem ☰
// ---------------------------------------------------------------
// v3.9: + každý dotykový displej na šířku do výšky 700 px – ať je rozložení na všech telefonech stejné
const RIDE_MQ = window.matchMedia('(max-width:760px), (max-height:520px), (pointer:coarse) and (orientation:landscape) and (max-height:700px)');
const menuBtn = document.getElementById('menu-btn');
function setHeaderOpen(open){
  document.body.classList.toggle('header-open', !!open);
  if(menuBtn){ menuBtn.classList.toggle('active', !!open); menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  positionFloatingMapButtons();
  // mapa změnila velikost
  setTimeout(()=> window.dispatchEvent(new Event('resize')), 30);
}
function applyRideUi(){
  const on = RIDE_MQ.matches;
  const was = document.body.classList.contains('ride-ui');
  document.body.classList.toggle('ride-ui', on);
  if(!on) setHeaderOpen(false);
  if(on && !was){
    // seznam tras na začátku sbalený, ať je vidět mapa
    const rl = document.getElementById('route-list');
    if(rl) rl.classList.add('collapsed');
    if(typeof setRecCompact === 'function' && rec && rec.state !== 'idle') setRecCompact(true);
  }
  positionFloatingMapButtons();
}
// v2.11: ☰ otevře dlaždicové menu přes celou obrazovku (místo vysunutí hlavičky)
if(menuBtn) menuBtn.addEventListener('click', ()=>{
  if(window.CendurHeader && CendurHeader.openTiles) CendurHeader.openTiles();
  else setHeaderOpen(!document.body.classList.contains('header-open'));
});
// v jízdním režimu: přiblížení o 3 úrovně najednou (−3 / +3)
(function addZoom3Buttons(){
  const zo = document.getElementById('zoom-out-btn');
  if(!zo || document.getElementById('zoom-in3-btn')) return;
  zo.insertAdjacentHTML('afterend', '<button class="map-btn map-btn-square" id="zoom-in3-btn" type="button" aria-label="Přiblížit o 3">+3</button><button class="map-btn map-btn-square" id="zoom-out3-btn" type="button" aria-label="Oddálit o 3">−3</button>');
  window.CendurZoom.bind(()=>map, { in1:'zoom-in-btn', out1:'zoom-out-btn', in3:'zoom-in3-btn', out3:'zoom-out3-btn' }, zoomOpts);
})();
// v jízdním režimu je hlavička schovaná → seznam tras otevírá tlačítko nad mapou
(function addRoutesMapButton(){
  if(document.getElementById('routes-map-btn')) return;
  const sat = document.getElementById('satellite-btn');
  if(!sat) return;
  sat.insertAdjacentHTML('afterend', '<button class="map-btn map-btn-square" id="routes-map-btn" type="button" title="Seznam tras" aria-label="Seznam tras">≣</button>');
  document.getElementById('routes-map-btn').addEventListener('click', ()=>{
    const b = document.getElementById('open-routes');
    if(b) b.click();
  });
})();
// v jízdním režimu se seznam tras otevírá tlačítkem „Trasy“ v hlavičce (jazýček u okraje by kolidoval s tlačítky)
(function addRoutesButton(){
  const up = document.getElementById('open-upload');
  if(!up || document.getElementById('open-routes')) return;
  up.insertAdjacentHTML('beforebegin', '<button class="btn" id="open-routes" type="button">Trasy</button>');
  document.getElementById('open-routes').addEventListener('click', ()=>{
    const rl = document.getElementById('route-list');
    const opening = rl.classList.contains('collapsed');
    rl.classList.toggle('collapsed');
    if(opening && detailPanelEl.classList.contains('open')) closeDetail();
    if(opening) setHeaderOpen(false);
  });
})();
if(RIDE_MQ.addEventListener) RIDE_MQ.addEventListener('change', applyRideUi); else if(RIDE_MQ.addListener) RIDE_MQ.addListener(applyRideUi);


// v3.8: tlačítko 🗺/🛰 přepíná podkladovou mapu (klepnutí); podržením se otevře nabídka
// dalších vrstev (benzínky, CHKO – doplní je fuel.js / chko.js)
const satelliteBtn = document.getElementById('satellite-btn');
document.body.insertAdjacentHTML('beforeend', `<div id="layer-menu" role="menu">
  <div class="layer-menu-title">Podkladová mapa</div>
</div>`);
const layerMenu = document.getElementById('layer-menu');
function openLayerMenu(){ placeLayerMenu(); layerMenu.classList.add('open'); }
function placeLayerMenu(){
  const r = satelliteBtn.getBoundingClientRect();
  if(r.left + r.width/2 < window.innerWidth/2){
    // tlačítko vlevo (jízdní režim) -> nabídka vedle něj doprava
    layerMenu.style.left = Math.round(r.right + 8) + 'px';
    layerMenu.style.right = 'auto';
    layerMenu.style.top = Math.round(r.top) + 'px';
  } else {
    layerMenu.style.left = 'auto';
    layerMenu.style.top = Math.round(r.bottom + 8) + 'px';
    layerMenu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
  }
  layerMenu.style.maxHeight = Math.max(160, window.innerHeight - parseFloat(layerMenu.style.top) - 8) + 'px';
  layerMenu.style.overflowY = 'auto';
}
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
    // v3.9.1: první údaj o směru hned vykreslit (dřív se čekalo na změnu o práh)
    lastHeadingUpdateTs = performance.now();
    if(headingMode==='heading'){ if(!panelCoversMap()) setMapRotation(true); } else updateArrowRotation(displayedHeading);
    return;
  } else {
    smoothedHeading = smoothAngle(smoothedHeading, rawDeg, alpha);
  }
  const now = performance.now();
  const change = Math.abs(angleDiff(smoothedHeading, displayedHeading));
  if(change >= thresholdDeg && (now - lastHeadingUpdateTs) >= minUpdateMs){
    displayedHeading = smoothedHeading;
    lastHeadingUpdateTs = now;
    if(headingMode==='heading'){ if(!panelCoversMap()) setMapRotation(true); } else updateArrowRotation(displayedHeading);
  }
}

function onPosition(pos){
  const latlng = [pos.coords.latitude, pos.coords.longitude];
  lastLatLng = latlng;
  freePosPredicted = !!pos.predicted;

  // rychlost v km/h (GPS coords.speed je v m/s); chybějící/neplatnou hodnotu bereme jako 0
  currentSpeedKmh = (pos.coords.speed != null && !isNaN(pos.coords.speed)) ? pos.coords.speed * 3.6 : 0;

  // Nad prahovou rychlostí bereme směr z GPS kurzu (na motorce za jízdy stabilnější než kompas).
  // Pod prahem (stání, pomalá technická pasáž) je GPS kurz nespolehlivý - směr pak dodává kompas
  // telefonu (viz startOrientation), pokud je uživatel zapnul.
  if(currentSpeedKmh > HEADING_SPEED_THRESHOLD_KMH && pos.coords.heading != null && !isNaN(pos.coords.heading)){
    feedHeading(pos.coords.heading, HEADING_FILTER_ALPHA_GPS, HEADING_UPDATE_THRESHOLD_DEG_GPS, HEADING_MIN_UPDATE_MS_GPS);
  }

  freeUpdate(latlng);
  // v4.0: šipka přichycená ke sledované trase (když jsem na ní), jinak skutečná poloha
  const shown = (navOn && freeSnapLL) ? freeSnapLL : latlng;
  shownLatLng = shown;
  ensureGpsMarker(shown, pos.coords.accuracy);
  if(gpsMarker){ const el = gpsMarker.getElement(); if(el) el.classList.toggle('gps-predicted', !!pos.predicted); }
  if(followMode && !navManualActive()) setFollowView(shown, true);
  updateTilt(currentSpeedKmh);
  // dopočtená poloha (výpadek signálu) se do záznamu jízdy ani projetí tras nepočítá
  if(pos.predicted) return;
  recOnPosition(pos);
  // v4.3: najeté km do profilu jezdce (jen přihlášený, navigace nebo záznam jízdy)
  if(currentUser && window.CendurRider && (navOn || rec.state === 'recording')) window.CendurRider.track(pos);
  // v2.5: projetí tras se počítá jen při navigaci nebo záznamu jízdy a jen přihlášeným
  if(window.CendurRides && currentUser && (navOn || rec.state === 'recording')){
    window.CendurRides.track(latlng[0], latlng[1], navOn ? 'atlas' : 'record');
  }
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
    if(gpsW){ gpsW.stop(); gpsW = null; }
    watchId = null;
  }
  toast('Polohu se nepodařilo získat: ' + (err.message || 'neznámá chyba'));
  setNavMode(false);
}

// Zapne jen odběr GPS (pokud ještě neběží) - poloha a šipka se aktualizují, záznam jízdy běží.
// v4.0: poloha přes společný modul public/gps.js (filtr nepřesných poloh a skoků, dopočet
// při výpadku – po sledované trase, v aplikaci přímo z GPS čipu)
let gpsW = null, gpsBadge = null, freeStatus = null;
function onGpsStatus(st){
  if(!freeStatus) freeEnsureHud();
  if(!gpsBadge && window.CendurGPS && freeStatus) gpsBadge = window.CendurGPS.badge(freeStatus);
  if(!gpsBadge) return;
  if(navOn) gpsBadge.update(st); else gpsBadge.hide();
}
function startGpsWatch(){
  if(!navigator.geolocation && !(window.CendurApp && window.CendurApp.startGps)){ toast('Prohlížeč nepodporuje GPS polohu.'); return false; }
  if(watchId!=null) return true;
  gpsW = window.CendurGPS.watch(onPosition, onPositionError, { predict:true, onStatus:onGpsStatus });
  gpsW.setPredictor(freePredict);
  watchId = 1;
  return true;
}

// Kompas telefonu (doplněk pro pomalou jízdu); na iPhonu vyžaduje svolení - proto se volá z klepnutí.
function enableCompass(){
  if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
    DeviceOrientationEvent.requestPermission().then(perm=>{
      if(perm === 'granted') startOrientation();
      else toast('Kompas nedostupný – pod 5 km/h bude směr méně přesný, nad 5 km/h se použije GPS kurz.');
    }).catch(()=>{});
  } else {
    startOrientation();
  }
}

// ---------------------------------------------------------------
// v2.11: Volná jízda v Atlasu (jako v Android Auto)
//  - při navigaci se aplikace sama „chytí“ nejbližší trasy (do 40 m, pustí ji nad 90 m) a zvýrazní ji
//  - klepnutím na trasu ji vybereš („Trasa: …“), klepnutím do prázdné mapy zpět do volné jízdy
//  - má-li aktivní trasa roadbook a jedeš po jeho směru, nahoře je šipka další instrukce s odpočtem
// ---------------------------------------------------------------
const FREE_CATCH_M = 40, FREE_RELEASE_M = 90;
let freeGuide = null, freeGuideId = null;   // v3.1: zvuky k instrukcím roadbooku v Atlasu
// v3.9.1: kde na trase právě jsem (m od startu) – hledá se kolem minulého místa, ať trasa,
// která vede dvakrát stejnou cestou (tam a zpět, osmička), „nepřeskakuje“. Připojit se jde kdekoli.
const FREE_OFF_M = 50, FREE_BACK_WIN = 200, FREE_FWD_WIN = 1500;
let freeProg = null, freeProgId = null, freeWasOn = false;
// v4.0: přichycení k trase a dopočet polohy po trase při výpadku GPS
const FREE_SNAP_M = 25;
let freeSnapLL = null, freeR = null, shownLatLng = null;
let freeProgReal = null, freePosPredicted = false;   // místo na trase z poslední SKUTEČNÉ polohy (základ dopočtu)
const freePlainCache = {};
function freePlainR(id){
  if(freePlainCache[id] === undefined){
    const r = routesCache[id];
    freePlainCache[id] = (r && Array.isArray(r.points) && r.points.length > 1) ? window.CendurRB.prepareRoute(r.points, false) : null;
  }
  return freePlainCache[id];
}
// dopočet polohy po sledované trase (public/gps.js volá při výpadku signálu)
function freePredict(lastPos, meters){
  const RB = window.CendurRB;
  if(!RB || !freeR || freeProgReal == null || !freeWasOn) return null;
  const R = freeR.R, s = Math.min(R.total, freeProgReal + meters);
  const q = RB.pointAt(R, s);
  return { lat:q[0], lon:q[1], heading: RB.bearingBetween(R, s, Math.min(R.total, s + 30)) };
}
// místo na trase do 60 m od mě, kde trasa vede STEJNÝM směrem, jakým jedu (u tras tam a zpět
// je stejná cesta na trase dvakrát – v každém směru jednou); null = žádné takové
function freeMatchDir(R, lat, lon, hdg){
  const RB = window.CendurRB, px = lon * R.kx, py = lat * R.ky;
  let best = null;
  for(let i = 0; i < R.n - 1; i++){
    const ax = R.x[i], ay = R.y[i], dx = R.x[i+1] - ax, dy = R.y[i+1] - ay, L2 = dx*dx + dy*dy;
    let t = L2 > 0 ? ((px-ax)*dx + (py-ay)*dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(px - (ax + dx*t), py - (ay + dy*t));
    if(d > 60) continue;
    const sv = R.s[i] + (R.s[i+1] - R.s[i]) * t;
    const dir = RB.bearingBetween(R, sv, Math.min(R.total, sv + 40));
    if(dir == null || Math.abs(RB.angleDiff(hdg, dir)) > 70) continue;
    if(!best || d < best.dist) best = { dist:d, s:sv };
  }
  return best;
}
let freeCaughtId = null, freePickedId = null, freeRouteClickTs = 0;
let freeSums = null;               // stavy roadbooků (route_id → souhrn)
const freeRb = {};                 // route_id → { R, vis } | 'loading' | null
function freeActiveId(){ return freePickedId != null ? freePickedId : freeCaughtId; }
function freeShort(name){ const w = String(name || '').trim().split(/\s+/); return w.length <= 3 ? w.join(' ') : w.slice(0, 3).join(' ') + '…'; }
function freeDistM(route, la, lo, limit){
  const pts = route.points;
  if(!pts || pts.length < 2) return Infinity;
  if(!route._bb){
    let a = 90, b = -90, c = 180, d = -180;
    pts.forEach(p=>{ if(p[0] < a) a = p[0]; if(p[0] > b) b = p[0]; if(p[1] < c) c = p[1]; if(p[1] > d) d = p[1]; });
    route._bb = [a, b, c, d];
  }
  const ky = 111320, kx = 111320 * Math.cos(la * Math.PI / 180), bb = route._bb;
  if(la < bb[0] - limit / ky || la > bb[1] + limit / ky || lo < bb[2] - limit / kx || lo > bb[3] + limit / kx) return Infinity;
  let best = Infinity;
  for(let i = 0; i < pts.length - 1; i++){
    const ax = (pts[i][1] - lo) * kx, ay = (pts[i][0] - la) * ky, bx = (pts[i+1][1] - lo) * kx, by = (pts[i+1][0] - la) * ky;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    const px = ax + t * dx, py = ay + t * dy, dd = px * px + py * py;
    if(dd < best) best = dd;
  }
  return Math.sqrt(best);
}
function freeEnsureHud(){
  if(document.getElementById('free-hud')) return;
  document.getElementById('app-screen').insertAdjacentHTML('beforeend',
    '<div id="free-hud"><div id="free-corner"></div></div>');
  // v4.1: všechny hlášky (GPS, mimo trasu, režim) ve společném sloupci nahoře (public/status.js)
  freeStatus = window.CendurStatus.create(document.getElementById('free-hud'), { prepend:true, className:'cs-atlas' });
  // v4.15.2: ťuknutí na pruh režimu – vybraná trasa → volná jízda; „na trase …“ → trasu vybrat (u roadbooku nabídka)
  document.getElementById('free-hud').addEventListener('click', e => {
    if(!navOn || !e.target.closest('.cs-item[data-key="mode"]')) return;
    e.stopPropagation();
    if(freePickedId != null){ freePick(null); return; }
    const id = freeCaughtId;
    if(id == null){ toast('Žádná trasa poblíž – přijeď k trase nebo na ni ťukni v mapě.', 2500); return; }
    const RB = window.CendurRB;
    if(RB && freeSums && freeSums[id] && RB.stateOf(freeSums[id]) !== 'auto' && rec.state === 'idle'){ freeAsked.add(id); freeOfferAsk(id); }
    else freePick(id);
  });
}
async function freeStart(){
  freeEnsureHud();
  freeCaughtId = null; freePickedId = null;
  if(!freeSums && window.CendurRB){
    try{ const list = await api('/api/roadbooks'); freeSums = {}; (list || []).forEach(x=>{ freeSums[x.route_id] = x; }); }
    catch(e){ freeSums = {}; }
  }
  if(lastLatLng) freeUpdate(lastLatLng); else freeRender();
}
function freeStop(){
  freeSnapLL = null; freeR = null;
  const old = freeActiveId();
  freeCaughtId = null; freePickedId = null;
  if(old != null) applyRouteStyle(old);
  freeRender();
}
function freePick(id){
  const old = freeActiveId();
  freePickedId = id;
  freeProg = null; freeProgReal = null; freeProgId = null; freeWasOn = false;   // nové sledování – poloha na trase znovu od místa, kde jsem
  if(freeGuide) freeGuide.reset();
  if(id == null && lastLatLng) freeCatch(lastLatLng);
  const now = freeActiveId();
  if(old != null) applyRouteStyle(old);
  if(now != null) applyRouteStyle(now);
  // v4.15.2: bez toastu – totéž už ukazuje modrý pruh nahoře (Trasa: … / Volná jízda)
  if(now != null) freeLoadRb(now);
  freeRender();
}
function freeCatch(latlng){
  const cur = freeCaughtId != null ? routesCache[freeCaughtId] : null;
  if(cur && freeDistM(cur, latlng[0], latlng[1], 200) < FREE_RELEASE_M) return;
  let best = null, bestD = FREE_CATCH_M;
  Object.values(routesCache).forEach(r=>{
    if(!r || (layersById[r.id] && !map.hasLayer(layersById[r.id]))) return;   // skryté trasy se nechytají
    let d = freeDistM(r, latlng[0], latlng[1], 100);
    if(freeSums && freeSums[r.id]) d -= 10;   // trasy s roadbookem mají přednost
    if(d < bestD){ bestD = d; best = r; }
  });
  freeCaughtId = best ? best.id : null;
}
function freeUpdate(latlng){
  if(!navOn) return;
  const old = freeActiveId();
  freeCatch(latlng);
  const now = freeActiveId();
  if(old !== now){ if(old != null) applyRouteStyle(old); if(now != null) applyRouteStyle(now); }
  if(now != null) freeLoadRb(now);   // načte se jen jednou (a jen když trasa roadbook má)
  freeRender();
  freeOffer(latlng);
}
// v4.15: přijedu k trase s roadbookem → nabídka Atlas NAVI | Roadbook | Ne (jednou; znovu až po vzdálení na 200 m)
const FREE_ASK_M = 40, FREE_ASK_RESET_M = 200;
const freeAsked = new Set();
function freeOffer(latlng){
  const RB = window.CendurRB;
  if(!RB || !freeSums || !navOn || !currentUser) return;
  [...freeAsked].forEach(id => { const r = routesCache[id]; if(!r || freeDistM(r, latlng[0], latlng[1], FREE_ASK_RESET_M + 100) > FREE_ASK_RESET_M) freeAsked.delete(id); });
  if(freePickedId != null || freeCaughtId == null || freeAsked.has(freeCaughtId)) return;
  if(rec.state !== 'idle' || (window.CendurHeader && CendurHeader.askOpen())) return;   // při nahrávání jízdy neodcházet ze stránky
  const id = freeCaughtId, r = routesCache[id], st = RB.stateOf(freeSums[id]);
  if(!r || !freeSums[id] || st === 'auto') return;
  if(freeDistM(r, latlng[0], latlng[1], 100) > FREE_ASK_M) return;
  freeAsked.add(id);
  freeOfferAsk(id);
}
// nabídka Atlas NAVI | Roadbook | Ne – u trasy s roadbookem (sama při příjezdu i po ťuknutí na pruh nahoře)
function freeOfferAsk(id){
  const RB = window.CendurRB, r = routesCache[id], st = RB.stateOf(freeSums && freeSums[id]);
  const note = st === 'check' ? 'Roadbook je ke kontrole.' : st === 'draft' ? 'Roadbook je zatím rozpracovaný.' : 'Trasa má roadbook.';
  CendurHeader.ask({
    title: 'Jsi u trasy „' + r.name + '“',
    msg: note + ' Jak chceš jet?',
    choices: [
      { icon:'🧭', label:'Atlas NAVI', sub:'mapa, instrukce v rohu', cls:'atlas', fn: () => freePick(id) },
      { icon:'📒', label:'Roadbook', sub:'velké instrukce, počítadlo', cls:'rb', fn: () => { location.href = 'roadbook-navi.html?trasa=' + id + '&jed=1'; } },
      { label:'Ne', cls:'no', countdown:10 }
    ]
  });
}
async function freeLoadRb(id){
  const RB = window.CendurRB;
  if(!RB || !freeSums || !freeSums[id] || freeRb[id] !== undefined) return;
  freeRb[id] = 'loading';
  try{
    const res = await api('/api/roadbooks/' + id);
    const rb = res && res.roadbook, route = routesCache[id];
    if(!rb || !rb.data || !Array.isArray(rb.data.items) || !route){ freeRb[id] = null; return; }
    const reversed = !!(rb.data.settings && rb.data.settings.reversed);
    const R = RB.prepareRoute(route.points, reversed);
    let items = rb.data.items.map(x=>Object.assign({ sides: [], icons: [] }, x));
    if(rb.stale) items = RB.reproject(R, items);
    RB.recompute(R, items);
    freeRb[id] = { R, vis: RB.visible(items) };
  }catch(e){ freeRb[id] = null; }
  freeRender();
}
function freeRender(){
  const hud = document.getElementById('free-hud');
  if(!hud) return;
  hud.classList.toggle('open', navOn);
  if(!navOn) return;
  const RB = window.CendurRB;
  const picked = freePickedId != null ? routesCache[freePickedId] : null;
  const caught = freeCaughtId != null ? routesCache[freeCaughtId] : null;
  freeStatus.set('mode', {
    title: picked ? 'Trasa: ' + freeShort(picked.name) : 'Volná jízda',
    sub: picked ? 'ťukni = volná jízda' : caught ? 'na trase: ' + freeShort(caught.name) + ' · ťukni' : '',
    tone: picked ? 'blue' : 'dark', prio: 10 });
  let routeNote = null;   // hláška „mimo trasu“ / „proti směru“ (do společného sloupce)
  // roh s další instrukcí roadbooku
  const box = document.getElementById('free-corner');
  const id = freeActiveId(), rbRaw = id != null ? freeRb[id] : null;
  const rb = rbRaw && rbRaw !== 'loading' ? rbRaw : null;
  const followed = freePickedId != null && freePickedId === id;
  // v4.0: sledovaná trasa i bez roadbooku – kvůli přichycení šipky a dopočtu polohy po trase
  const R = rb ? rb.R : (followed && RB ? freePlainR(id) : null);
  let html = '';
  freeSnapLL = null;
  if(RB && R && lastLatLng){
    const lat = lastLatLng[0], lon = lastLatLng[1];
    if(freeProgId !== id){ freeProg = null; freeProgReal = null; freeProgId = id; freeWasOn = false; }
    // první určení: kdekoli na trase (připojení v půlce); u okruhu / dvakrát projeté cesty
    // se vezme místo nejblíž začátku
    const moving = currentSpeedKmh > HEADING_SPEED_THRESHOLD_KMH;
    if(freeProg == null){
      const m = moving ? freeMatchDir(R, lat, lon, displayedHeading) : null;
      const p0 = m || (RB.projectInitial ? RB.projectInitial(R, lat, lon) : RB.project(R, lat, lon));
      if(p0.dist <= 60) freeProg = p0.s;
    }
    let p = freeProg != null
      ? RB.project(R, lat, lon, Math.max(0, freeProg - FREE_BACK_WIN), Math.min(R.total, freeProg + FREE_FWD_WIN))
      : RB.project(R, lat, lon);
    if(p.dist > 40){ const g = RB.project(R, lat, lon); if(g.dist + 15 < p.dist) p = g; }
    const off = p.dist > FREE_OFF_M;
    if(!off){ freeProg = p.s; freeWasOn = true; if(!freePosPredicted) freeProgReal = p.s; }
    // zvuky jen u trasy, kterou sleduju (vybraná klepnutím) – stejné jako v Roadbook NAVI
    const guide = () => {
      if(!window.CendurSound) return null;
      if(!freeGuide || freeGuideId !== id){ freeGuide = CendurSound.createGuide(); freeGuideId = id; }
      return freeGuide;
    };
    let dir = !off ? RB.bearingBetween(R, p.s, Math.min(R.total, p.s + 40)) : null;
    // jedu proti směru úseku, na kterém mě to drží → není kousek dál stejná cesta po směru (tam a zpět)?
    if(!off && moving && dir != null && Math.abs(RB.angleDiff(displayedHeading, dir)) > 110){
      const m = freeMatchDir(R, lat, lon, displayedHeading);
      if(m){ p = { dist:m.dist, s:m.s }; freeProg = m.s; dir = RB.bearingBetween(R, p.s, Math.min(R.total, p.s + 40)); }
    }
    // v4.0: přichycení šipky k sledované trase (do 25 m, po směru) – klidnější šipka, přesnější instrukce
    freeR = followed ? { id, R } : null;
    if(followed && !off && p.dist <= FREE_SNAP_M && !(moving && dir != null && Math.abs(RB.angleDiff(displayedHeading, dir)) > 110)){
      freeSnapLL = RB.pointAt(R, p.s);
    }
    if(!off && rb){
      if(moving && dir != null && Math.abs(RB.angleDiff(displayedHeading, dir)) > 110){
        routeNote = { title:'Jedeš proti směru roadbooku', tone:'warn', prio:5 };
      } else {
        if(followed && guide()) freeGuide.update(rb.vis, p.s, currentSpeedKmh / 3.6, false);
        const nx = rb.vis.find(it=>it.s > p.s + 8);
        if(nx) html = '<div class="fc-card">' + RB.tulipSVG(nx, 92) + '<div class="fc-d">' + RB.fmtDist(Math.max(0, nx.s - p.s)) + '</div><div class="fc-l">' + escapeHtml(RB.label(nx)) + '</div></div>';
      }
    } else if(off && followed && freeWasOn){
      // vyjel jsem ze sledované trasy → upozornění (jemný tón + „Jsi mimo trasu“)
      routeNote = { title:'Mimo trasu · ' + RB.fmtDist(p.dist), tone:'bad', prio:5 };
      if(rb && guide()) freeGuide.update(rb.vis, freeProg, currentSpeedKmh / 3.6, true);
    }
  }
  if(routeNote) freeStatus.set('route', routeNote); else freeStatus.clear('route');
  box.innerHTML = html;
}

// Jedno tlačítko „Navigovat v Atlasu / Ukončit navigaci“ (dřív „Sleduji / Nesleduji polohu“):
//  zapnuto  = sledovat polohu + mapa natočená podle směru jízdy + silnější čáry tras
//  vypnuto  = mapa volně posouvatelná, sever nahoru, normální čáry (GPS a záznam běží dál)
function setNavMode(on){
  if(on){
    if(!requireLogin('navigaci')) return;
    if(!startGpsWatch()) return;
    navOn = true;
    followMode = true;
    enableCompass();
    headingMode = 'heading';
  } else {
    navOn = false;
    followMode = false;
    headingMode = 'north';
    if(gpsBadge) gpsBadge.hide();
  }
  if(!navOn){ tiltCur = tiltTarget = 0; tiltLayout = false; if(tiltRaf){ cancelAnimationFrame(tiltRaf); tiltRaf = 0; } }
  layoutMapForMode();
  setMapRotation(headingMode === 'heading');
  if(followMode && lastLatLng) setFollowView(shownLatLng || lastLatLng, false);
  if(navOn) freeStart(); else freeStop();
  locateBtn.classList.toggle('active', navOn);
  locateBtnLabel.textContent = navOn ? 'Ukončit navigaci' : 'NAVIGOVAT';
  locateBtn.setAttribute('aria-pressed', navOn ? 'true' : 'false');
  document.body.classList.toggle('nav-on', navOn);
  if(navOn) Object.values(layersById).forEach(l => { if(l && l.closeTooltip) l.closeTooltip(); });
  // čáry tras a záznamu podle režimu
  Object.keys(layersById).forEach(applyRouteStyle);
  if(recLine) recLine.setStyle({ weight: routeWeight('rec') });
}

// v3.9.1: společné klepnutí (public/zoom.js) – spolehlivé i v rukavicích
window.CendurZoom.tap(locateBtn, ()=>{ if(!navOn && window.CendurSound) CendurSound.unlock(); setNavMode(!navOn); });

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

// V režimu "směr jízdy" se mapa otáčí. #map je čtverec, jehož STŘED leží přesně na místě
// šipky na obrazovce (vodorovně uprostřed, svisle ve followMarkerFraction() výšky).
// CSS rotace se točí kolem středu prvku (transform-origin: center), takže se mapa otáčí
// přímo kolem GPS bodu. Strana čtverce = 2× vzdálenost šipky k nejvzdálenějšímu rohu
// obrazovky, aby při jakémkoli natočení nebyly v rozích prázdné kusy.
// Mapa se NEzvětšuje (žádné scale), úroveň přiblížení zůstává, jaká byla.
function layoutMapForMode(){
  const wrap = mapEl.parentElement;
  if(headingMode==='heading'){
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const f = followMarkerFraction();
    const cx = w / 2, cy = h * f;                       // místo šipky na obrazovce
    let r = Math.hypot(w / 2, Math.max(cy, h - cy));    // k nejvzdálenějšímu rohu
    if(tiltLayout){
      // nakloněná mapa: horní okraj obrazovky „vidí“ dál → kam až na mapě sahá (perspektiva)
      const P = tiltPerspective(), th = TILT_MAX_DEG * Math.PI / 180;
      const yFar = cy * P / Math.max(1, P * Math.cos(th) - cy * Math.sin(th));
      const xFar = (w / 2) * (P + yFar * Math.sin(th)) / P;
      r = Math.max(r, Math.hypot(xFar, yFar)) * 1.04;
    }
    const d = Math.ceil(2 * r) + 2;
    mapEl.style.inset = 'auto';
    mapEl.style.left = Math.round(cx - d / 2) + 'px';
    mapEl.style.top = Math.round(cy - d / 2) + 'px';
    mapEl.style.width = d + 'px';
    mapEl.style.height = d + 'px';
  } else {
    mapEl.style.inset = '';
    mapEl.style.left = mapEl.style.top = mapEl.style.width = mapEl.style.height = '';
  }
  // Leaflet si přepočítá rozměry; střed mapy i přiblížení přitom zůstanou stejné
  map.invalidateSize({ animate:false });
}
window.addEventListener('resize', ()=>{
  if(map && headingMode==='heading'){
    layoutMapForMode();
    // po otočení displeje se mění i výška šipky -> znovu ji posadit do středu otáčení
    if(followMode && lastLatLng) setFollowView(shownLatLng || lastLatLng, false);
  }
});

// ---------------------------------------------------------------
// v2.11: náklon mapy za jízdy – nad 30 km/h se mapa plynule nakloní (max 30°), ať je vidět dál.
// Náklon se rozjíždí mezi 25 a 35 km/h (žádné cukání kolem hranice), tiltne se kolem šipky.
// Když je mapa nakloněná, #map se zvětší, aby u horního okraje nebyla prázdná místa.
// ---------------------------------------------------------------
const TILT_MAX_DEG = 30;
const TILT_FROM_KMH = 25, TILT_TO_KMH = 35;
let tiltCur = 0, tiltTarget = 0, tiltRaf = 0, tiltLayout = false, tiltLowSince = 0;
function tiltForSpeed(kmh){
  const t = Math.min(1, Math.max(0, (kmh - TILT_FROM_KMH) / (TILT_TO_KMH - TILT_FROM_KMH)));
  return t * t * (3 - 2 * t) * TILT_MAX_DEG;
}
function tiltPerspective(){ return Math.round(Math.max(window.innerWidth, window.innerHeight) * 1.2); }
function updateTilt(kmh){
  const want = (headingMode === 'heading' && followMode) ? tiltForSpeed(kmh) : 0;
  tiltTarget = want;
  // větší mapa (víc dlaždic) jen když se opravdu jede rychle; zpět až po 15 s pod 20 km/h
  const now = Date.now();
  if(want > 0 && !tiltLayout){ tiltLayout = true; layoutMapForMode(); if(lastLatLng) setFollowView(shownLatLng || lastLatLng, false); }
  if(tiltLayout && want === 0 && tiltCur < 0.5){
    if(kmh < 20){ if(!tiltLowSince) tiltLowSince = now; } else tiltLowSince = 0;
    if(tiltLowSince && now - tiltLowSince > 15000){ tiltLayout = false; tiltLowSince = 0; layoutMapForMode(); if(lastLatLng) setFollowView(shownLatLng || lastLatLng, false); }
  } else tiltLowSince = 0;
  if(!tiltRaf && Math.abs(tiltTarget - tiltCur) > 0.05) tiltRaf = requestAnimationFrame(tiltStep);
}
function tiltStep(){
  tiltRaf = 0;
  const d = tiltTarget - tiltCur;
  // plynule: ~1,5 s na celý náklon
  tiltCur += Math.sign(d) * Math.min(Math.abs(d), 0.35);
  if(Math.abs(tiltTarget - tiltCur) < 0.05) tiltCur = tiltTarget;
  if(headingMode === 'heading' && !panelCoversMap()) setMapRotation(true);
  if(tiltCur !== tiltTarget) tiltRaf = requestAnimationFrame(tiltStep);
}
function mapTransform(){
  const rot = 'rotate(' + (-mapRotDeg) + 'deg)';
  return tiltCur > 0.05 ? 'perspective(' + tiltPerspective() + 'px) rotateX(' + tiltCur.toFixed(2) + 'deg) ' + rot : rot;
}

function setMapRotation(on){
  if(on){
    if(!navManualActive()) mapRotDeg = displayedHeading;
    mapEl.style.transform = mapTransform();
    // ikonky benzínek se otáčejí zpět, ať zůstávají "rovně" i na otočené mapě
    mapEl.style.setProperty('--map-rot', mapRotDeg + 'deg');
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    // Šipka je vnořená uvnitř #map, takže zdědí i jeho rotaci (rotace se v CSS sčítají).
    // Aby vizuálně zůstala pořád "nahoru" (jako ukazatel směru jízdy) a ne přilepená
    // k severu na otáčející se mapě, musí mít opačnou (kompenzující) rotaci -
    // tedy přesně +displayedHeading, aby se s rotací mapy (-displayedHeading) vyrušila na 0.
    updateArrowRotation(displayedHeading);
  } else {
    mapRotDeg = 0;
    mapEl.style.transform = 'none';
    mapEl.style.setProperty('--map-rot', '0deg');
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    updateArrowRotation(displayedHeading);
  }
}

// (samostatné tlačítko „Sever nahoru / Směr jízdy“ je od v1.47 sloučené do tlačítka polohy – setNavMode)

// ---------------------------------------------------------------
// v3.9: gesta při navigaci – jedním prstem posun, dvěma přiblížení (i na otočené a nakloněné
// mapě, kde vestavěná gesta Leafletu nefungují správně). Po 4 s bez dotyku se mapa sama vrátí
// na sledování polohy; přiblížení zůstává, jak si ho nastavíš (stejně jako v Roadbook NAVI).
// ---------------------------------------------------------------
const NAV_MANUAL_MS = 4000;
let navManualUntil = 0, navBackTimer = null;
function navManualActive(){ return navManualUntil > Date.now(); }
function navManualTouch(){
  navManualUntil = Date.now() + NAV_MANUAL_MS;
  clearTimeout(navBackTimer);
  navBackTimer = setTimeout(navManualBack, NAV_MANUAL_MS + 30);
}
function navManualBack(){
  if(navManualActive()){ navBackTimer = setTimeout(navManualBack, navManualUntil - Date.now() + 30); return; }
  navManualUntil = 0;
  // mapa se znovu natočí po směru jízdy a vystředí na polohu
  if(headingMode === 'heading' && !panelCoversMap()) setMapRotation(true);
  if(followMode && lastLatLng) setFollowView(shownLatLng || lastLatLng, true);
}
(function navGestures(){
  const wrap = mapEl.parentElement;
  const pts = new Map();           // pointerId -> {x, y}
  let panning = false, start = null, pinch = null, raf = 0, pendingZoom = null, gestureEnd = 0;
  const active = () => navOn && headingMode === 'heading';
  // posun na obrazovce → posun na mapě: mapa je otočená o -heading (a nakloněná), proto vektor
  // otočíme zpět a svislou složku zvětšíme podle náklonu
  function panScreen(dx, dy){
    const tilt = tiltCur * Math.PI / 180;
    if(tilt > 0.01) dy = dy / Math.max(0.5, Math.cos(tilt));
    const h = mapRotDeg * Math.PI / 180, c = Math.cos(h), s = Math.sin(h);
    const mx = dx * c - dy * s, my = dx * s + dy * c;
    map.panBy(L.point(-mx, -my), { animate:false });
  }
  function dist(){ const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  function mid(){ const a = [...pts.values()]; return { x:(a[0].x + a[1].x) / 2, y:(a[0].y + a[1].y) / 2 }; }
  wrap.addEventListener('pointerdown', e => {
    if(!active() || e.target.closest('#route-list, #detail-panel, .leaflet-control, .leaflet-popup')) return;
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(pts.size === 1){ start = { x:e.clientX, y:e.clientY }; panning = false; }
    if(pts.size === 2){
      pinch = { d0: Math.max(10, dist()), z0: map.getZoom(), m: mid() };
      map.options.zoomSnap = 0;     // plynulé přiblížení během gesta
      navManualTouch();
    }
  });
  wrap.addEventListener('pointermove', e => {
    if(!pts.has(e.pointerId) || !active()) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(pinch && pts.size >= 2){
      const m = mid();
      panScreen(m.x - pinch.m.x, m.y - pinch.m.y);
      pinch.m = m;
      pendingZoom = Math.max(3, Math.min(19, pinch.z0 + Math.log2(dist() / pinch.d0)));
      if(!raf) raf = requestAnimationFrame(() => { raf = 0; if(pendingZoom != null) map.setZoom(pendingZoom, { animate:false }); });
      navManualTouch();
      return;
    }
    if(pts.size === 1){
      if(!panning && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
      panning = true;
      panScreen(e.clientX - prev.x, e.clientY - prev.y);
      navManualTouch();
    }
  });
  function up(e){
    if(!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if(pinch && pts.size < 2){
      pinch = null; gestureEnd = Date.now();
      if(raf){ cancelAnimationFrame(raf); raf = 0; }
      map.options.zoomSnap = 1;
      map.setZoom(Math.round(pendingZoom != null ? pendingZoom : map.getZoom()), { animate:false });
      pendingZoom = null;
      // zbývající prst dál posouvá od místa, kde je
      const rest = [...pts.values()][0];
      if(rest){ start = { x:rest.x, y:rest.y }; panning = true; }
    }
    if(pts.size === 0){ if(panning) gestureEnd = Date.now(); panning = false; }
  }
  wrap.addEventListener('pointerup', up);
  wrap.addEventListener('pointercancel', up);
  // posunutá mapa nesmí po klepnutí hned vybrat trasu – klepnutí po posunu zahodit
  wrap.addEventListener('click', e => { if(panning || Date.now() - gestureEnd < 400){ e.stopPropagation(); e.preventDefault(); } }, true);
})();

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
const IS_STANDALONE = (window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || window.navigator.standalone === true;
if(IS_STANDALONE) document.body.classList.add('standalone');   // spuštěno z plochy - celá obrazovka už je
function fsElement(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
function fsRequest(){
  const el = document.documentElement;
  if(el.requestFullscreen) return el.requestFullscreen();
  if(el.webkitRequestFullscreen) return el.webkitRequestFullscreen();   // starší Chrome / Samsung Internet
  if(el.webkitRequestFullScreen) return el.webkitRequestFullScreen();
  return Promise.reject(new Error('unsupported'));
}
function fsExit(){
  if(document.exitFullscreen) return document.exitFullscreen();
  if(document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if(document.webkitCancelFullScreen) return document.webkitCancelFullScreen();
  return Promise.resolve();
}
function showInstallHelp(){
  let ov = document.getElementById('a2hs-overlay');
  if(!ov){
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="a2hs-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="a2hs-title">
          <button class="detail-close" id="a2hs-close" type="button" aria-label="Zavřít">×</button>
          <h2 id="a2hs-title">Celá obrazovka</h2>
          <p class="sub">${isIOS
            ? 'Safari na iPhonu webům celou obrazovku nedovolí. Přidej si CendurOFF na plochu – z ikony se pak otevře přes celý displej bez adresního řádku, jako aplikace.'
            : 'Tenhle prohlížeč celou obrazovku nepodporuje. Přidej si CendurOFF na plochu – z ikony se pak otevře přes celý displej bez adresního řádku, jako aplikace.'}</p>
          <ol class="a2hs-steps">${isIOS
            ? '<li>Dole v Safari klepni na <b>Sdílet</b> (čtvereček se šipkou nahoru).</li><li>Vyber <b>Přidat na plochu</b> a potvrď <b>Přidat</b>.</li><li>Otevírej CendurOFF ikonou z plochy.</li>'
            : '<li>V prohlížeči otevři menu <b>⋮</b>.</li><li>Vyber <b>Přidat na plochu</b> (nebo <b>Instalovat aplikaci</b>).</li><li>Otevírej CendurOFF ikonou z plochy.</li>'}</ol>
        </div>
      </div>`);
    ov = document.getElementById('a2hs-overlay');
    document.getElementById('a2hs-close').addEventListener('click', ()=> ov.classList.remove('open'));
    ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
  }
  ov.classList.add('open');
}
fullscreenBtn.addEventListener('click', async ()=>{
  if(fsElement()){ try{ await fsExit(); }catch(e){} return; }
  try{
    await fsRequest();
    // některé prohlížeče požadavek tiše ignorují -> když se do chvíle nic nestane, ukážeme návod
    setTimeout(()=>{ if(!fsElement()) showInstallHelp(); }, 800);
  }catch(e){ showInstallHelp(); }
});
function onFsChange(){
  fullscreenBtn.classList.toggle('active', !!fsElement());
  fullscreenBtn.title = fsElement() ? 'Ukončit celou obrazovku' : 'Celá obrazovka';
  setTimeout(positionFloatingMapButtons, 50);
}
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);


// Benzínky a CHKO: od v1.50 sdílené moduly public/fuel.js a public/chko.js (stejné v Atlasu i Plánovači)

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
    recLine = L.polyline(rec.points.map(p=>[p[0],p[1]]), { pane:'rec-track', color:REC_COLOR, weight:routeWeight('rec'), opacity:0.95, interactive:false }).addTo(map);
  }
}
// sbalený panel záznamu = jen tečka, čas a km (ťuknutím se rozbalí na Pauza / Stop)
function setRecCompact(on){
  if(!recPanel) return;
  recPanel.classList.toggle('compact', !!on);
  const t = document.getElementById('rec-toggle');
  if(t){ t.textContent = on ? '▴' : '▾'; t.setAttribute('aria-expanded', on ? 'false' : 'true'); }
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
  if(!requireLogin('záznam jízdy')) return;
  if(!startGpsWatch()) return;
  if(!navOn) setNavMode(true);
  setRecCompact(document.body.classList.contains('ride-ui'));
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
  const recToggle = document.getElementById('rec-toggle');
  if(recToggle) recToggle.addEventListener('click', e=>{ e.stopPropagation(); setRecCompact(!recPanel.classList.contains('compact')); });
  // ve sbaleném stavu rozbalí panel ťuknutí kamkoli na lištu
  recPanel.addEventListener('click', e=>{
    if(recPanel.classList.contains('compact') && !e.target.closest('button')) setRecCompact(false);
  });
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
        body: JSON.stringify({ name, description, routeType, fromRecording: true, points: rec.points.map(p=>[p[0],p[1],p[2]]) })
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
  setRecCompact(document.body.classList.contains('ride-ui'));
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
  appEntered = true;
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-screen').style.display='flex';
  if(window.CendurHeader) window.CendurHeader.setUser(currentUser);
  initMap();
  applyRideUi();
  setTimeout(()=>map.invalidateSize(), 50);
  if(!enterApp._fuelBound){
    enterApp._fuelBound = true;
    if(window.CendurFuel) CendurFuel.attach(map, layerMenu);
    if(window.CendurChko) CendurChko.attach(map, layerMenu);
  }
  positionFloatingMapButtons();
  setTimeout(positionFloatingMapButtons, 100);
  await loadRoutes();
  requestWakeLock();
  // dlaždice „+ Nahrát trasu“ z jiné stránky → index.html?nahrat=1
  try{
    const u = new URL(location.href);
    if(u.searchParams.get('nahrat')){
      u.searchParams.delete('nahrat'); history.replaceState(null, '', u);
      document.getElementById('open-upload')?.click();
    }
  }catch(e){}
  if(rec.state==='idle' && currentUser) restoreRecording();
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
    document.body.classList.remove('auth-pending');
    enterApp();
  }catch(e){
    // v4.2: nepřihlášený – Atlas bez účtu; přihlašovací obrazovka jen když o ni stránka
    // výslovně žádá (?next=… z Planneru apod., ?login=1)
    document.body.classList.remove('auth-pending');
    const q = new URLSearchParams(location.search);
    if(q.get('next') || q.get('login')) return;
    enterApp();
  }
})();
// pojistka: kdyby server dlouho neodpovídal, přihlašovací obrazovka se ukáže nejpozději po 8 s
setTimeout(()=> document.body.classList.remove('auth-pending'), 8000);

})();
