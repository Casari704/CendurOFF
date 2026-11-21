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
      `<button class="panel-tab" id="route-list-tab" type="button" title="Skrýt/zobrazit seznam tras" aria-label="Skrýt/zobrazit seznam tras"><span class="tab-arrow">‹</span><span class="tab-txt">TRASY</span></button>`);
  }
  if(!document.getElementById('detail-panel-tab')){
    const panel = document.getElementById('detail-panel');
    if(panel) panel.insertAdjacentHTML('afterbegin',
      `<button class="panel-tab" id="detail-panel-tab" type="button" title="Zavřít detail trasy" aria-label="Zavřít detail trasy"><span class="tab-arrow">‹</span></button>`);
  }
  if(!document.getElementById('rec-btn')){
    const lc = document.getElementById('locate-controls');
    if(lc) lc.insertAdjacentHTML('afterbegin', `
      <button class="map-btn rec-btn" id="rec-btn" type="button" title="Stopař – nahrávat projetou trasu">
        <span class="map-btn-icon"><span class="rec-icon"></span></span>
        <span class="map-btn-label" id="rec-btn-label">Stopař</span>
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
            <button class="ghost-btn" id="ride-planner" type="button">✏️ Upravit v GPX planneru</button>
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
    if(fb) fb.insertAdjacentHTML('beforebegin', `<button class="map-btn map-btn-square" id="menu-btn" type="button" title="Menu" aria-label="Zobrazit / skrýt menu" aria-expanded="false"><svg class="menu-grid" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg></button>`);
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
  transport: { label:'Transportní', color:'#00C853', z:430 },
  cenduro:   { label:'Cenduro',     color:'#FF8800', z:420 },
  offroad:   { label:'Offroad',     color:'#FF1744', z:410 }
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
  return (n && /^(planovac|merch|faq|komunita|admin|nastaveni|roadbook-planner)\.html(\?[^#]*)?$/.test(n)) ? n : null;
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
// v4.58: když server vyčerpá nepřihlášenému limit na mapová data, nabídne se přihlášení (viz errors.js)
window.CendurAskLogin = () => requireLogin('další mapová data');
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
const API_URL = window.CENDUROFF_API_URL || 'https://api.cenduroff.cz'; // prázdná/chybějící adresa = Railway

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
// v4.73: stahování GPX tras se odemyká nahráním první trasy (správci a moderátoři ho mají hned)
const GPX_LOCK_MSG = 'Stahování GPX se odemkne po nahrání první trasy.';
function gpxAllowed(){
  const u = currentUser;
  return !!u && (u.role === 'admin' || u.role === 'moderator' || (u.ownRoutes || 0) > 0);
}
function gpxGuard(){
  if(gpxAllowed()) return true;
  const msg = currentUser ? GPX_LOCK_MSG + ' Nahraj trasu (tlačítko Nahrát GPX) nebo ulož svou jízdu a stahování se ti zpřístupní.' : 'Stahování GPX je pro přihlášené. Přihlas se a nahraj svoji první trasu, tím se stahování odemkne.';
  if(window.CendurHeader && window.CendurHeader.ask) window.CendurHeader.ask({ title:'Stahování GPX je zamčené', msg, yes: currentUser ? { label:'Rozumím' } : { label:'Přihlásit se', fn: () => showLoginOverlay('stahování GPX') }, no: currentUser ? undefined : { label:'Zavřít' } });
  else toast(msg, 5000);
  return false;
}
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
  document.getElementById('li-forgot').hidden = reg;
  formMsg.textContent = '';
}
// v4.60: „Zapomněl jsem heslo“ – zapíše žádost, admin pošle dočasné heslo
document.getElementById('li-forgot').addEventListener('click', async ()=>{
  const u = liUser.value.trim().toLowerCase();
  formMsg.style.color = '';
  if(!u){ formMsg.textContent = 'Napiš nahoru svůj e-mail a klepni znovu na „Zapomněl jsem heslo“.'; return; }
  try{
    const r = await api('/api/auth/forgot', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: u }) });
    formMsg.style.color = 'var(--moss-dark)';
    formMsg.textContent = (r && r.message) || 'Žádost je odeslána.';
  }catch(err){ formMsg.textContent = err.message || 'Žádost se nepodařilo odeslat.'; }
});
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
    if(user.mustChangePassword){ location.replace('nastaveni.html?zmena=1'); return; }   // v4.60: dočasné heslo → nejdřív nové
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
function normalStyle(id){
  return { color: typeInfo(routesCache[id]).color, weight:routeWeight('normal'), opacity: navOn ? 1 : 0.9 };
}

// Je trasa "modrá"? Buď je otevřená v detailu, nebo je zaškrtnutá ve výběru více tras.
function isRouteMarked(id){
  if(navOn && !selectMode && freeActiveId() != null) return Number(id) === Number(freeActiveId());
  return selectMode ? selectedIds.has(Number(id)) : Number(id)===Number(activeRouteId);
}
// Přesune čáru do jiné vrstvy mapy (Leaflet to umí jen přes odebrání a opětovné přidání).
// v4.51: na dotykových zařízeních má každá trasa neviditelný široký pruh pro ťuknutí (±14 px kolem čáry).
// (v4.50 kreslila trasy na plátno s tolerancí, ale plátno nepočítá s otočenou mapou – ťuknutí se minula.)
const ROUTE_HIT_PX = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 14 : 0;
function addRouteHit(line){
  if(!ROUTE_HIT_PX) return;
  const hit = L.polyline(line.getLatLngs(), { pane: line.options.pane, weight: 2 * ROUTE_HIT_PX + 6, opacity: 0, interactive: true, bubblingMouseEvents: false });
  ['click', 'contextmenu'].forEach(t => hit.on(t, e => line.fire(t, e)));
  line._hit = hit;
  line.on('add', () => { if(map.hasLayer(hit)) map.removeLayer(hit); hit.options.pane = line.options.pane; hit.addTo(map); });
  line.on('remove', () => { if(map.hasLayer(hit)) map.removeLayer(hit); });
  if(map.hasLayer(line)) line.fire('add');
}
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
  const pane = 'route-' + typeOf(route);
  const line = L.polyline(latlngs, Object.assign({ pane }, normalStyle(route.id)));
  // v4.44: bez bílého obtažení (s průhledností tras je pod čarou vidět cesta)
  line.addTo(map);
  addRouteHit(line);
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
  selectionDownloadBtn.classList.toggle('locked', !gpxAllowed());
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
selectionDownloadBtn.addEventListener('click', ()=> { if(gpxGuard()) downloadTracks(selectedTracks()); });

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
// v4.35: výjezdy z výškového profilu
// Výška se převzorkuje po 10 m a vyhladí (±40 m), ať šum GPS nedělá falešné kopečky.
// Výjezd = souvislé stoupání; končí, když výška klesne o víc než 10 m pod dosažené maximum.
// Počítá se výjezd s převýšením aspoň 25 m a průměrným sklonem aspoň 3 %.
// ---------------------------------------------------------------
function computeClimbs(points){
  const d = [], e = [];
  let dist = 0;
  for(let i=0;i<points.length;i++){
    if(i) dist += haversine(points[i-1], points[i]);
    const ele = points[i][2];
    if(ele != null && !isNaN(ele)){ d.push(dist); e.push(+ele); }
  }
  if(d.length < 5 || dist < 200) return null;
  const STEP = 10, n = Math.floor(d[d.length-1] / STEP) + 1;
  const raw = new Float64Array(n);
  let j = 0;
  for(let k=0;k<n;k++){
    const x = k * STEP;
    while(j < d.length - 2 && d[j+1] < x) j++;
    const span = d[j+1] - d[j];
    const t = span > 0 ? Math.max(0, Math.min(1, (x - d[j]) / span)) : 0;
    raw[k] = e[j] + (e[j+1] - e[j]) * t;
  }
  const W = 4, sm = new Float64Array(n);           // klouzavý průměr ±40 m
  let acc = 0, cnt = 0;
  for(let k=0;k<Math.min(n, W);k++){ acc += raw[k]; cnt++; }
  for(let k=0;k<n;k++){
    if(k + W < n){ acc += raw[k+W]; cnt++; }
    if(k - W - 1 >= 0){ acc -= raw[k-W-1]; cnt--; }
    sm[k] = acc / cnt;
  }
  const climbs = [];
  let low = 0, top = 0;
  // úsek od nejnižšího bodu k nejvyššímu; rovinky na začátku a konci se uříznou (6 % převýšení, min. 3 m)
  const close = () => {
    if(top <= low) return;
    const tol = Math.max(3, (sm[top] - sm[low]) * 0.06);
    let b = low; while(b < top && sm[b] < sm[top] - tol) b++;    // první místo, kde je skoro nahoře
    let a = b;   while(a > low && sm[a] > sm[low] + tol) a--;     // poslední místo před ním, kde je ještě skoro dole
    const gain = sm[top] - sm[low], len = (b - a) * STEP, g = len > 0 ? (sm[b] - sm[a]) / len : 0;
    if(gain >= 25 && g >= 0.03) climbs.push({ from: a*STEP, to: b*STEP, gain, len, grade: g * 100 });
  };
  for(let k=1;k<n;k++){
    if(sm[k] < sm[low] && top === low){ low = k; top = k; continue; }   // ještě klesá – začátek se posouvá
    if(sm[k] > sm[top]) top = k;
    if(sm[top] - sm[k] > 10){ close(); low = k; top = k; }
  }
  close();
  // nejprudší úsek: nejvyšší sklon na 100 m
  let maxGrade = 0;
  for(let k=10;k<n;k++){ const g = (sm[k] - sm[k-10]) / 100 * 100; if(g > maxGrade) maxGrade = g; }
  const totGain = climbs.reduce((a,c)=>a+c.grade*c.len, 0) / 100, totLen = climbs.reduce((a,c)=>a+c.len, 0);
  const biggest = climbs.reduce((b,c)=> !b || c.gain > b.gain ? c : b, null);
  return { climbs, biggest, avgGrade: totLen ? totGain / totLen * 100 : 0, maxGrade, total: dist };
}
function fmtKm(m){ return m >= 1000 ? (m/1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m/10)*10 + ' m'; }
function renderClimbStats(cl){
  const avg = cl && cl.biggest ? cl.avgGrade.toFixed(0) + ' %' : (cl ? '0 %' : '–');
  const max = cl ? Math.round(cl.maxGrade) + ' %' : '–';
  return `<div class="stat"><b>${avg}</b><span>Ø stoupání</span></div><div class="stat"><b>${max}</b><span>nejprudší úsek</span></div>`;
}
// v4.35: povrch trasy, brody a závory (server je spočítá z OpenStreetMap a uloží)
const SURF = [
  { k:'asfalt',   label:'Asfalt',            cls:'sf-asf' },
  { k:'sotolina', label:'Šotolina',          cls:'sf-sot' },
  { k:'hlina',    label:'Hlína a ostatní',   cls:'sf-hli' },
  { k:'nezname',  label:'Mimo cesty v mapě', cls:'sf-unk' }
];
function renderTerrainBox(t){
  if(!t) return '<h3>Povrch trasy</h3><p class="hint">Zjišťuji povrch z mapy…</p>';
  const s = t.surface || {};
  const pct = k => Math.round((s[k] || 0) * 100);
  const bar = SURF.filter(x => (s[x.k] || 0) > 0.004).map(x => `<i class="${x.cls}" style="width:${((s[x.k]||0)*100).toFixed(1)}%" title="${x.label} ${pct(x.k)} %"></i>`).join('');
  const legend = SURF.filter(x => x.k !== 'nezname' || pct('nezname') > 0).map(x => `<span><i class="${x.cls}"></i>${x.label} <b>${pct(x.k)} %</b></span>`).join('');
  const obst = [];
  if(t.fords) obst.push(`${t.fords} ${t.fords === 1 ? 'brod' : t.fords < 5 ? 'brody' : 'brodů'}`);
  if(t.barriers) obst.push(`${t.barriers} ${t.barriers === 1 ? 'závora' : t.barriers < 5 ? 'závory' : 'závor'}`);
  return `<h3>Povrch trasy</h3>
    <div class="surf-bar">${bar}</div>
    <div class="surf-legend">${legend}</div>
    ${obst.length ? '<p class="surf-obst">Na trase: ' + obst.join(' · ') + '</p>' : ''}`;
}
const terrainCache = {};
async function loadTerrain(routeId, tries){
  const box = document.getElementById('detail-terrain');
  if(!box) return;
  tries = tries || 0;
  if(terrainCache[routeId]){ box.innerHTML = renderTerrainBox(terrainCache[routeId]); return; }
  try{
    const res = await fetch(API_URL + '/api/routes/' + routeId + '/terrain', withAuth());
    if(res.status === 429 && window.CendurLoginNeeded) window.CendurLoginNeeded(res);
    if(res.status === 202){
      if(tries < 60) setTimeout(()=>{ if(activeRouteId === routeId) loadTerrain(routeId, tries + 1); }, 5000);
      else box.innerHTML = '<h3>Povrch trasy</h3><p class="hint">Mapová data se zatím nepodařilo zpracovat, zkus detail otevřít později.</p>';
      return;
    }
    if(!res.ok) throw new Error('server ' + res.status);
    const j = await res.json();
    terrainCache[routeId] = j.data;
    if(activeRouteId !== routeId || !document.getElementById('detail-terrain')) return;
    document.getElementById('detail-terrain').innerHTML = renderTerrainBox(j.data);
  }catch(e){
    if(activeRouteId !== routeId) return;
    const b = document.getElementById('detail-terrain');
    if(b) b.innerHTML = '<h3>Povrch trasy</h3><p class="hint">Povrch teď nejde zjistit' + (navigator.onLine === false ? ' (jsi offline).' : '.') + '</p>';
  }
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
  const climbs = computeClimbs(route.points || []);   // v4.35: výjezdy

  const photoSlots = [0,1,2].map(i=>{
    const p = photos[i];
    if(!p){
      return `<div class="photo-slot"><span class="empty-plus">·</span></div>`;
    }
    return `<div class="photo-slot">
        <img class="photo-thumb" data-index="${i}" src="${escapeHtml(p.data_url)}" alt="Fotka trasy ${escapeHtml(route.name)}" title="Zvětšit fotku">
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
      <button type="button" class="go-rb" id="detail-go-rb" hidden>📒 <span class="t">Roadbook<small>Roadbook NAVI</small></span></button>
    </div>
    <div class="detail-off" id="detail-off" hidden></div>
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
      ${renderClimbStats(climbs)}
    </div>
    <div class="gpx-actions">
      <button class="ghost-btn" id="download-gpx-btn" type="button">⬇ Stáhnout GPX</button>
      <button class="ghost-btn" id="share-route-btn" type="button">🔗 Sdílet odkaz</button>
      ${isOwner ? `<a class="ghost-btn planner-link" href="planovac.html?trasa=${route.id}">✏️ Upravit v GPX planneru</a>` : ''}
    </div>
    <div class="detail-terrain" id="detail-terrain">${renderTerrainBox(terrainCache[route.id] || null)}</div>
    <div class="elev-profile">
      <h3>Výškový profil</h3>
      ${renderElevationProfile(route.points)}
    </div>
    <div class="photo-grid">${photoSlots}</div>
    ${currentUser && currentUser.role === 'admin' ? '<div class="admin-stats" id="admin-stats"><h3>Projetí trasy <span class="admin-tag">admin</span></h3><p class="hint">Načítám…</p></div>' : ''}
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
    el.removeAttribute('href');
    if(st !== 'auto'){ el.title = 'Jet podle roadbooku'; el.style.cursor = 'pointer'; el.onclick = e => { e.preventDefault(); startRoadbook(route.id); }; }
    el.hidden = false;
    // v4.15: velké tlačítko Roadbook jen u trasy s roadbookem – v4.26: jízda přes celou obrazovku přímo v Atlasu
    const gr = inner.querySelector('#detail-go-rb');
    if(gr && st !== 'auto'){
      gr.onclick = () => startRoadbook(route.id);
      gr.hidden = false; inner.querySelector('#detail-go').classList.remove('one');
      renderDetailOffline(inner, route);
    }
  }).catch(() => {});
  // v4.15: ▶ Navigovat – Atlas NAVI rovnou po téhle trase
  inner.querySelector('#detail-go-atlas').addEventListener('click', () => {
    if(!currentUser){ requireLogin('navigaci'); return; }
    if(window.CendurSound) CendurSound.unlock();
    const rid = route.id;
    closeDetail();
    if(!navOn) setNavMode(true);
    if(navOn){ freeAsked.set(rid, 0); freePick(rid); }
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

  const dlBtn = document.getElementById('download-gpx-btn');
  dlBtn.classList.toggle('locked', !gpxAllowed());
  if(!gpxAllowed()) dlBtn.title = GPX_LOCK_MSG;
  dlBtn.addEventListener('click', ()=> { if(gpxGuard()) downloadGPX(route.points, route.name); });
  if(currentUser && currentUser.role === 'admin') loadAdminStats(route.id);
  loadTerrain(route.id);
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
// v4.18: totéž tlačítko i v seznamu tras (na mobilu, kde hlavička není)
document.getElementById('list-upload')?.addEventListener('click', ()=> document.getElementById('open-upload')?.click());
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
    if(currentUser) currentUser.ownRoutes = (currentUser.ownRoutes || 0) + 1;
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
let orientAbs=null, orientRel=null;   // v4.58: odběry kompasu (jdou odpojit po ukončení navigace)

// --- Nastavení směrové navigace (naladěno pro motorku / pomalé technické pasáže) ---
const HEADING_SPEED_THRESHOLD_KMH = 5;     // nad touto rychlostí bereme směr z GPS kurzu, pod ní z kompasu telefonu
const HEADING_FILTER_ALPHA_GPS = 0.35;     // vyhlazení GPS kurzu (0-1, vyšší = pružnější reakce)
const HEADING_FILTER_ALPHA_COMPASS = 0.06; // vyhlazení kompasu (silný filtr - magnetometr je v klidu i za jízdy dost "cukavý")
const HEADING_UPDATE_THRESHOLD_DEG_GPS = 2;      // GPS kurz: změny menší než toto se ignorují (v4.31: z 4°, otočení je teď plynulé)
const HEADING_UPDATE_THRESHOLD_DEG_COMPASS = 3;   // kompas: práh (v4.30: 3° – po opravě zdroje stačí malý, šipka nekrokuje)
const HEADING_MIN_UPDATE_MS_GPS = 0;             // GPS: kurz chodí ~1× za s, každý se použije (v4.31)
const HEADING_MIN_UPDATE_MS_COMPASS = 66;        // kompas: přepočet max ~15x/s (v4.30)
const HEADING_COMPASS_TAU_MS = 250;              // časová konstanta vyhlazení kompasu (v4.30: 0,25 s – menší prodleva)
// poloha šipky na obrazovce při sledování (0 = nahoře, 1 = dole): na výšku 80 %, na šířku
// (nízký displej) 75 % – ať je před šipkou vidět co nejvíc trasy
const FOLLOW_MARKER_Y_PORTRAIT = 0.80;
const FOLLOW_MARKER_Y_LANDSCAPE = 0.75;
function followMarkerFraction(){ return window.innerWidth > window.innerHeight ? FOLLOW_MARKER_Y_LANDSCAPE : FOLLOW_MARKER_Y_PORTRAIT; }

// Vycentruje mapu tak, aby se GPS bod nezobrazil uprostřed obrazovky, ale
// v dolní třetině (FOLLOW_MARKER_Y_FRACTION) - ať je vidět víc mapy před sebou.
// Posun se počítá ve směru aktuálního natočení mapy (v režimu "směr jízdy" tedy
// ve směru jízdy), takže funguje správně i po otočení/zvětšení mapy.
// v4.48: tichý posun mapy (bez událostí moveend) – pro plynulé dojíždění za jízdy. Událost moveend
// spouští překreslení všech tras, dlaždic a vrstev; při 60 posunech za sekundu to žralo baterku.
function quietPan(center){
  const c = map.latLngToContainerPoint(center), half = map.getSize().divideBy(2);
  const off = L.point(Math.round(c.x - half.x), Math.round(c.y - half.y));
  if(!off.x && !off.y) return;
  if(typeof map._rawPanBy === 'function'){ map._rawPanBy(off); map.fire('move'); }
  else map.panBy(off, { animate:false });
}
function setFollowView(latlng, animate, quiet){
  const z = map.getZoom();
  // V režimu "směr jízdy" je #map čtverec vystředěný přímo na místo šipky (viz layoutMapForMode),
  // takže GPS bod stačí dát doprostřed mapy - leží pak přesně ve středu otáčení a při
  // natočení mapy zůstává na místě (žádné "excentrické" houpnutí a dojíždění).
  if(headingMode==='heading'){
    if(quiet) quietPan(latlng); else map.setView(latlng, z, { animate: !!animate });
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
  if(quiet) quietPan(center); else map.setView(center, z, { animate: !!animate });
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
  const follow = followMode && lastLatLng && !navManualActive();
  return { min:3, max:19, after: follow ? ()=> setFollowView(shownLatLng || lastLatLng, false) : null,
           anchor: follow && headingMode !== 'heading' && gpsMarker ? ()=> gpsMarker.getLatLng() : null };
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
let arrowShownDeg = null;   // v4.27: „rozbalený“ úhel – CSS přechod se točí kratší cestou
function updateArrowRotation(deg){
  const el = document.getElementById('gps-arrow');
  if(!el) return;
  arrowShownDeg = arrowShownDeg == null ? deg : arrowShownDeg + angleDiff(deg, arrowShownDeg);
  el.style.transform = 'rotate('+arrowShownDeg+'deg)';
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
  // v4.31: interval mezi polohami z GPS (obvykle ~1 s) – podle něj se rozprostře pohyb i otočení
  const nowTs = performance.now();
  const fixGap = lastFixTs ? Math.max(300, Math.min(1500, nowTs - lastFixTs)) : 1000;
  lastFixTs = nowTs;
  const gpsCourse = currentSpeedKmh > HEADING_SPEED_THRESHOLD_KMH && pos.coords.heading != null && !isNaN(pos.coords.heading);
  // otočení mapy podle GPS kurzu se rozprostře na celý interval (plynule), u kompasu krátký přechod
  setRotationGlide(gpsCourse && navOn ? fixGap : 150);
  if(gpsCourse){
    feedHeading(pos.coords.heading, gpsHeadingAlpha(currentSpeedKmh), HEADING_UPDATE_THRESHOLD_DEG_GPS, HEADING_MIN_UPDATE_MS_GPS);
  }

  freeUpdate(latlng);
  // v4.0: šipka přichycená ke sledované trase (když jsem na ní), jinak skutečná poloha
  // v4.52: jinak na nejbližší cestu z OpenStreetMap, po které jedu (public/roadsnap.js) – GPS v telefonu
  // uhýbá o metry do strany. (v4.49 přichytávala k jakékoli trase – ale trasa nahraná z GPS je sama vedle cesty.)
  const snapAny = navOn && !freeSnapLL && !pos.predicted && window.CendurRoadSnap
    ? CendurRoadSnap.snap(latlng, gpsCourse ? pos.coords.heading : null, pos.coords.accuracy) : null;
  const shown = (navOn && freeSnapLL) ? freeSnapLL : (snapAny || latlng);
  shownLatLng = shown;
  // v4.31: za jízdy v navigaci šipka i mapa plynule „dojíždějí“ mezi polohami (jako Mapy.com),
  // cíl je kousek dopředu podle rychlosti a kurzu, ať šipka nezaostává za skutečnou polohou
  if(navOn && gpsMarker && currentSpeedKmh > GLIDE_MIN_KMH){
    let target = shown;
    const hdg = gpsCourse ? pos.coords.heading : null;   // v4.49: jen podle GPS kurzu (kompas v zatáčce ujížděl do strany)
    if(hdg != null){
      const ahead = Math.min(GLIDE_AHEAD_MAX_M, (currentSpeedKmh / 3.6) * (fixGap / 1000) * GLIDE_AHEAD_FRACTION);
      target = offsetLatLng(shown, hdg, ahead);
    }
    if(gpsAccuracyCircle) gpsAccuracyCircle.setRadius(pos.coords.accuracy || 20);
    glideTo(target, fixGap);
  } else {
    stopGlide();
    ensureGpsMarker(shown, pos.coords.accuracy);
    if(followMode && !navManualActive()) setFollowView(shown, true);
  }
  if(gpsMarker){ const el = gpsMarker.getElement(); if(el) el.classList.toggle('gps-predicted', !!pos.predicted); }
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
// ---------------------------------------------------------------
// v4.31: plynulý pohyb za jízdy – šipka (a mapa za ní) se posouvá každý snímek, ne skokem 1× za s
// ---------------------------------------------------------------
const GLIDE_MIN_KMH = 3;            // pod touto rychlostí bez animace (stání – nic neplave)
const GLIDE_AHEAD_FRACTION = 0.2;   // o kolik intervalu dopředu cílit (v4.49: z 0,5 – menší předpověď)
const GLIDE_AHEAD_MAX_M = 8;        // předpověď nejvýš 8 m (v4.49: z 25 m)
let lastFixTs = 0, glide = null;
function offsetLatLng(ll, brgDeg, m){
  const R = 6371000, b = brgDeg * Math.PI / 180, la = ll[0] * Math.PI / 180, lo = ll[1] * Math.PI / 180, d = m / R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [la2 * 180 / Math.PI, lo2 * 180 / Math.PI];
}
function stopGlide(){ if(glide){ if(glide.raf) cancelAnimationFrame(glide.raf); if(glide.moved) map.fire('moveend'); } glide = null; }
function glideTo(target, dur){
  const cur = gpsMarker ? gpsMarker.getLatLng() : null;
  const from = cur ? [cur.lat, cur.lng] : target;
  stopGlide();
  // velký skok (nová poloha po výpadku) – bez animace
  if(map.distance(from, target) > 150){ ensureGpsMarker(target); if(followMode && !navManualActive()) setFollowView(target, false); return; }
  const g = glide = { from, target, t0: performance.now(), dur: Math.max(200, dur), raf: 0, last: 0, moved: false };
  // v4.48: snímek nejvýš každých ~45 ms (~20× za s) – oko plynulost pozná, baterka a teplota telefonu taky
  const step = now => {
    if(glide !== g) return;
    if(map._animatingZoom || now - g.last < 45){ g.raf = requestAnimationFrame(step); return; }
    g.last = now;
    const k = Math.min(1, (now - g.t0) / g.dur);
    const p = [g.from[0] + (g.target[0] - g.from[0]) * k, g.from[1] + (g.target[1] - g.from[1]) * k];
    gpsMarker.setLatLng(p);
    if(gpsAccuracyCircle) gpsAccuracyCircle.setLatLng(p);
    if(followMode && !navManualActive()){ setFollowView(p, false, true); g.moved = true; }
    if(k < 1) g.raf = requestAnimationFrame(step);
    else { glide = null; if(g.moved) map.fire('moveend'); }   // jednou za polohu GPS: dlaždice, trasy, vrstvy
  };
  g.raf = requestAnimationFrame(step);
}
// otočení mapy a šipky: délka CSS přechodu podle zdroje (GPS = celý interval, lineárně)
let rotGlideMs = 150;
function setRotationGlide(ms){
  ms = Math.round(ms);
  if(Math.abs(ms - rotGlideMs) < 40) return;
  rotGlideMs = ms;
  mapEl.style.transitionDuration = ms + 'ms';
  const a = document.getElementById('gps-arrow'); if(a) a.style.transitionDuration = ms + 'ms';
}
// vyhlazení GPS kurzu podle rychlosti: pomalu je kurz neklidný (víc vyhladit), rychle přesný (reagovat hned)
function gpsHeadingAlpha(kmh){
  if(kmh < 12) return 0.45;
  if(kmh < 30) return 0.65;
  return 0.85;
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
// v4.58: úplné vypnutí GPS (odběr polohy, kompas, šipka na mapě) – volá se po ukončení navigace
function stopGpsWatch(){
  if(gpsW){ try{ gpsW.stop(); }catch(e){} gpsW = null; }
  watchId = null;
  stopOrientation();
  if(gpsBadge) gpsBadge.hide();
  if(map){
    if(gpsMarker){ map.removeLayer(gpsMarker); }
    if(gpsAccuracyCircle){ map.removeLayer(gpsAccuracyCircle); }
  }
  gpsMarker = null; gpsAccuracyCircle = null;
  currentSpeedKmh = 0;
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
const FREE_GIVEUP_M = 500, FREE_GIVEUP_MS = 60000;   // v4.49: kdy sledovanou trasu pustit
let freeOffSince = 0;
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
// v4.49: lišta Stopaře za jízdy pod hláškami nahoře (dřív ležela přes „Volná jízda“)
function placeRecPanel(){
  const rp = document.getElementById('rec-panel'), hud = document.getElementById('free-hud');
  if(!rp) return;
  if(!document.body.classList.contains('ride-ui') || !rp.classList.contains('open') || !hud || !hud.classList.contains('open') || !hud.offsetHeight){ rp.style.top = ''; return; }
  const top = Math.round(hud.getBoundingClientRect().bottom + 8) + 'px';
  if(rp.style.top !== top) rp.style.top = top;
}
window.addEventListener('resize', () => setTimeout(placeRecPanel, 300));
function freeEnsureHud(){
  if(document.getElementById('free-hud')) return;
  document.getElementById('app-screen').insertAdjacentHTML('beforeend',
    '<div id="free-hud"><div id="free-corner"></div></div>');
  // v4.1: všechny hlášky (GPS, mimo trasu, režim) ve společném sloupci nahoře (public/status.js)
  freeStatus = window.CendurStatus.create(document.getElementById('free-hud'), { prepend:true, className:'cs-atlas' });
  // v4.15.2: ťuknutí na pruh režimu – vybraná trasa → volná jízda; „na trase …“ → trasu vybrat (u roadbooku nabídka)
  document.getElementById('free-hud').addEventListener('click', e => {
    if(navOn && e.target.closest('.cs-item[data-key="dest"]')){ e.stopPropagation(); destCancel(); return; }
    if(!navOn || !e.target.closest('.cs-item[data-key="mode"]')) return;
    e.stopPropagation();
    if(freePickedId != null){ freePick(null); return; }
    const id = freeCaughtId;
    if(id == null){ toast('Žádná trasa poblíž – přijeď k trase nebo na ni ťukni v mapě.', 2500); return; }
    const RB = window.CendurRB;
    if(RB && freeSums && freeSums[id] && RB.stateOf(freeSums[id]) !== 'auto'){ freeAsked.set(id, 0); freeOfferAsk(id); }
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
  destClear(true);
  freeSnapLL = null; freeR = null;
  const old = freeActiveId();
  freeCaughtId = null; freePickedId = null;
  if(old != null) applyRouteStyle(old);
  freeRender();
}
function freePick(id){
  if(id != null) destClear(true);   // v4.59: vybraná trasa nahradí navigaci k cíli
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
  destUpdate(latlng);
}
// ---------------------------------------------------------------
// v4.59: navigace k bodu v mapě (dlouhý stisk → „Navigovat sem“)
//  - cestu najde public/routing.js (Mapy.com, jinak OpenStreetMap); nic se neukládá
//  - mimo cestu déle než 20 s → přepočet z místa, kde jsem (s odpočtem ve společném sloupci hlášek)
//  - lišta „Cíl“ nahoře: ťuknutí = zrušit; na místě (30 m) se navigace sama ukončí zvukem
//  - nad 15 km/h se dlouhý stisk ignoruje; řidič se nemá co hrabat v mapě
//  - Atlas NAVI / Roadbook nabídka u tras funguje dál; zvolená trasa cíl nahradí, „Ne“ ho nechá
// ---------------------------------------------------------------
const DEST_LP_MS = 600, DEST_LP_MOVE = 10, DEST_MAX_KMH = 15;
const DEST_OFF_M = 60, DEST_OFF_MS = 20000, DEST_MIN_GAP_MS = 20000, DEST_ARRIVE_M = 30;
const DEST_KMH = { teren: 15, silnice: 40 };   // odhad času do cíle
let dest = null, destTmpPin = null, destTimer = 0, destLastCall = 0, destLpFired = 0;
// cíl: kolečko s černobílou kostkovanou vlajkou (střed kolečka = cíl)
const DEST_FLAG_SVG = '<svg viewBox="0 0 32 32" width="34" height="34"><defs><clipPath id="dfc"><circle cx="16" cy="16" r="14"/></clipPath></defs><circle cx="16" cy="16" r="14" fill="#fff"/><g clip-path="url(#dfc)" fill="#111"><rect x="0" y="0" width="8" height="8"/><rect x="16" y="0" width="8" height="8"/><rect x="8" y="8" width="8" height="8"/><rect x="24" y="8" width="8" height="8"/><rect x="0" y="16" width="8" height="8"/><rect x="16" y="16" width="8" height="8"/><rect x="8" y="24" width="8" height="8"/><rect x="24" y="24" width="8" height="8"/></g><circle cx="16" cy="16" r="14" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="16" r="15" fill="none" stroke="#111" stroke-width="1"/></svg>';
function destPinIcon(){ return L.divIcon({ className:'dest-pin', html:DEST_FLAG_SVG, iconSize:[34,34], iconAnchor:[17,17] }); }
function destMakePin(ll){ return L.marker(ll, { icon:destPinIcon(), interactive:false, keyboard:false, zIndexOffset:1000 }).addTo(map); }

// kam v mapě ukazuje prst: mapa může být otočená a nakloněná (jízdní režim), takže se bod
// nejdřív odhadne stejným přepočtem jako posun mapy a pak se zpřesní změřením, kde se značka opravdu vykreslí
function destLatLngAt(cx, cy){
  const probe = L.marker(map.getCenter(), { icon:L.divIcon({ className:'dest-probe', iconSize:[2,2], iconAnchor:[1,1] }), interactive:false, keyboard:false, opacity:0 }).addTo(map);
  const where = ll => { probe.setLatLng(ll); const r = probe.getElement().getBoundingClientRect(); return { x:r.left + r.width / 2, y:r.top + r.height / 2 }; };
  const tilt = tiltCur * Math.PI / 180, h = mapRotDeg * Math.PI / 180;
  const step = (ll, dx, dy, sign) => {
    if(tilt > 0.01) dy = dy / Math.max(0.5, Math.cos(tilt));
    const c = Math.cos(sign * h), s = Math.sin(sign * h);
    const cp = map.latLngToContainerPoint(ll);
    return map.containerPointToLatLng(L.point(cp.x + dx * c - dy * s, cp.y + dx * s + dy * c));
  };
  let ll = map.getCenter();
  try{
    for(let i = 0; i < 6; i++){
      const m = where(ll), dx = cx - m.x, dy = cy - m.y;
      if(Math.hypot(dx, dy) < 3) break;
      // kdyby byl znaménko otočení opačné, vyhraje to, které se trefí blíž
      const a = step(ll, dx, dy, 1), b = step(ll, dx, dy, -1);
      const ma = where(a), mb = where(b);
      ll = Math.hypot(cx - ma.x, cy - ma.y) <= Math.hypot(cx - mb.x, cy - mb.y) ? a : b;
    }
  }finally{ probe.remove(); }
  return ll;
}

function destTmpPinOff(){ if(destTmpPin){ destTmpPin.remove(); destTmpPin = null; } }
function destLongPress(x, y){
  if(currentSpeedKmh > DEST_MAX_KMH) return;   // za jízdy ticho
  if((window.CendurHeader && CendurHeader.askOpen()) || (window.CendurRide && CendurRide.isOpen())) return;
  if(!requireLogin('navigaci')) return;
  const p = destLatLngAt(x, y), pt = [p.lat, p.lng];
  destLpFired = Date.now();
  try{ if(navigator.vibrate) navigator.vibrate(30); }catch(e){}
  destTmpPinOff();
  destTmpPin = destMakePin(pt);
  CendurHeader.ask({
    title: 'Navigovat sem',
    msg: pt[0].toFixed(5) + ', ' + pt[1].toFixed(5),
    choices: [
      { label:'Navigovat sem offroadem', sub:'po stezkách a značených cestách', cls:'atlas', fn: () => { destTmpPinOff(); destStart(pt, 'teren'); } },
      { label:'Navigovat sem po cestách', sub:'po silnicích, nejkratší cesta', cls:'rb', fn: () => { destTmpPinOff(); destStart(pt, 'silnice'); } },
      { label:'Zrušit', cls:'no', fn: destTmpPinOff }
    ],
    onClose: destTmpPinOff
  });
}
(function destLongPressInit(){
  const wrap = mapEl.parentElement;
  let timer = 0, p0 = null, pid = null;
  const clear = () => { clearTimeout(timer); timer = 0; p0 = null; pid = null; };
  wrap.addEventListener('pointerdown', e => {
    if(e.target.closest('#route-list, #detail-panel, .leaflet-control, .leaflet-popup, .map-btn, #free-hud, #selection-bar, button, a')) return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    if(p0){ clear(); return; }   // druhý prst = štípání, ne dlouhý stisk
    p0 = { x:e.clientX, y:e.clientY }; pid = e.pointerId;
    timer = setTimeout(() => { const q = p0; clear(); if(q) destLongPress(q.x, q.y); }, DEST_LP_MS);
  });
  wrap.addEventListener('pointermove', e => { if(p0 && e.pointerId === pid && Math.hypot(e.clientX - p0.x, e.clientY - p0.y) > DEST_LP_MOVE) clear(); });
  wrap.addEventListener('pointerup', clear);
  wrap.addEventListener('pointercancel', clear);
  // po dlouhém stisku nesmí „dojezd“ ťuknutí nic vybrat; systémová nabídka (kontextové menu) se nepouští
  wrap.addEventListener('click', e => { if(Date.now() - destLpFired < 600){ e.stopPropagation(); e.preventDefault(); } }, true);
  wrap.addEventListener('contextmenu', e => { if(e.target.closest('#map')) e.preventDefault(); });
})();

function destStart(pt, mode){
  destClear(true);
  if(!navOn){ setNavMode(true); if(!navOn) return; }
  if(!map.getPane('dest-pane')){ const pn = map.createPane('dest-pane'); pn.style.zIndex = 450; pn.style.pointerEvents = 'none'; }
  dest = { ll: pt, mode, pts: null, R: null, prog: 0, offSince: 0, busy: false, pin: destMakePin(pt), line: null, notified: false };
  if(!destTimer) destTimer = setInterval(destTick, 1000);
  destTick();
}
function destClear(silent){
  if(destTimer){ clearInterval(destTimer); destTimer = 0; }
  if(dest){ if(dest.pin) dest.pin.remove(); if(dest.line) dest.line.remove(); dest = null; }
  if(freeStatus){ freeStatus.clear('dest'); freeStatus.clear('destoff'); }
}
function destCancel(){ if(!dest) return; destClear(); toast('Zrušeno', 1800); }
function destArrive(){
  destClear(true);
  try{ if(window.CendurSound) CendurSound.announce('gong', ''); }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate([120, 80, 120]); }catch(e){}
}
async function destFetch(from){
  const d = dest, RB = window.CendurRB;
  if(!d || d.busy || !RB || !window.CendurRouting) return;
  if(Date.now() - destLastCall < DEST_MIN_GAP_MS) return;   // kredity: nejvýš jedno hledání za 20 s
  d.busy = true; destLastCall = Date.now();
  try{
    const pts = await CendurRouting.find({ lat:from[0], lng:from[1] }, { lat:d.ll[0], lng:d.ll[1] }, d.mode);
    if(dest !== d) return;
    d.pts = pts; d.R = RB.prepareRoute(pts, false); d.prog = 0; d.offSince = 0; d.notified = false;
    if(d.line) d.line.remove();
    d.line = L.polyline(pts.map(p => [p[0], p[1]]), { pane:'dest-pane', color:'#1E64D6', weight:6, opacity:.9, lineCap:'round', lineJoin:'round', interactive:false }).addTo(map);
  }catch(e){
    if(dest !== d) return;
    if(/position not mapped|island/.test(String(e.message))){ destClear(); toast('Sem se cesta najít nedá.', 3500); return; }
    if(!d.notified){ d.notified = true; toast('Cestu se nepodařilo najít, zkouším znovu.', 3500); }
  }finally{ if(dest === d) d.busy = false; }
}
// při každé poloze: dojel jsem? jsem na cestě?
function destUpdate(ll){
  const d = dest, RB = window.CendurRB;
  if(!d || !RB) return;
  if(haversine(ll, d.ll) < DEST_ARRIVE_M){ destArrive(); return; }
  if(d.R){
    let p = RB.project(d.R, ll[0], ll[1], Math.max(0, d.prog - FREE_BACK_WIN), Math.min(d.R.total, d.prog + FREE_FWD_WIN));
    if(p.dist > 40){ const g = RB.project(d.R, ll[0], ll[1]); if(g.dist + 15 < p.dist) p = g; }
    if(p.dist <= DEST_OFF_M){ d.prog = p.s; d.offSince = 0; }
    else if(!d.offSince) d.offSince = Date.now();
  }
  destRender();
}
function destTick(){
  const d = dest;
  if(!d) return;
  if(!navOn){ destClear(true); return; }
  if(lastLatLng && !d.busy){
    if(!d.pts) destFetch(lastLatLng);
    else if(d.offSince && Date.now() - d.offSince >= DEST_OFF_MS) destFetch(lastLatLng);   // přepočet z místa, kde jsem
  }
  destRender();
}
function destFmtTime(min){ return min >= 60 ? Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0') + ' min' : min + ' min'; }
function destRender(){
  const d = dest, RB = window.CendurRB;
  if(!d || !freeStatus) return;
  let title;
  if(!d.pts) title = 'Cíl · hledám cestu…';
  else {
    const left = Math.max(0, d.R.total - d.prog);
    const min = Math.max(1, Math.round(left / 1000 / (DEST_KMH[d.mode] || 15) * 60));
    title = 'Cíl · ' + (RB ? RB.fmtDist(left) : Math.round(left) + ' m') + ' · ' + destFmtTime(min);
  }
  freeStatus.set('dest', { title, sub:'ťukni = zrušit', tone:'blue', prio:8 });
  if(d.offSince){
    const s = Math.ceil((DEST_OFF_MS - (Date.now() - d.offSince)) / 1000);
    freeStatus.set('destoff', { title: s > 0 ? 'Přepočítávám… ' + s + ' s' : 'Přepočítávám…', tone:'warn', prio:6 });
  } else freeStatus.clear('destoff');
}

// ---------------------------------------------------------------
// v4.26: jízda podle roadbooku přes celou obrazovku přímo v Atlasu (public/rb-ride.js)
//  přihlášený: skutečná jízda podle GPS; nepřihlášený: jen simulace s hláškou a přihlášením
// ---------------------------------------------------------------
function startRoadbook(id){
  const r = routesCache[id];
  if(!r || !window.CendurRide) return;
  destClear(true);
  if(window.CendurSound) CendurSound.unlock();
  // Atlas NAVI během jízdy podle roadbooku stojí (žádné dvojí zvuky a počítání); Stopař běží dál
  const wasNav = navOn;
  if(navOn) setNavMode(false, { suspend:true });
  closeDetail();
  window.CendurRide.start({
    route: r, guest: !currentUser, user: currentUser,
    loginHref: null,
    onEnd: () => { if(wasNav && currentUser){ setNavMode(true); if(navOn){ freeAsked.set(id, 0); freePick(id); } } }
  }).then(ok => { if(!ok && wasNav) setNavMode(true); });
}
// tlačítko „Přihlásit se“ v simulaci: ukončit simulaci, přihlásit a po přihlášení rovnou jet
document.addEventListener('click', e => {
  if(!e.target.closest || !e.target.closest('#nv-guest-login')) return;
  const id = (document.getElementById('nv-ride') || {}).dataset ? Number(document.getElementById('nv-ride').dataset.routeId) : 0;
  try{ if(id) sessionStorage.setItem('cenduroff.rbAfterLogin', String(id)); }catch(err){}
  window.CendurRide.stop();
  showLoginOverlay('jízdu podle roadbooku');
}, true);
function rbAfterLogin(){
  let id = null; try{ id = Number(sessionStorage.getItem('cenduroff.rbAfterLogin')) || null; sessionStorage.removeItem('cenduroff.rbAfterLogin'); }catch(e){}
  if(id && currentUser && routesCache[id]) setTimeout(() => startRoadbook(id), 300);
}
// uložení roadbooku do telefonu (jízda i bez signálu) – v detailu trasy pod tlačítky
async function renderDetailOffline(inner, route){
  const box = inner.querySelector('#detail-off');
  if(!box || !window.CendurRide || !currentUser) return;
  const info = await window.CendurRide.offline.info(route.id);
  box.hidden = false;
  box.innerHTML = info
    ? '<span class="ok">✓ Roadbook je v telefonu (' + new Date(info.savedAt).toLocaleDateString('cs-CZ') + ')</span><button type="button" data-a="upd">Aktualizovat</button><button type="button" data-a="del">Odebrat</button>'
    : '<button type="button" data-a="save">📥 Uložit roadbook do telefonu</button><span class="note">pojede i bez signálu</span>';
  box.onclick = async e => {
    const a = e.target.closest('button'); if(!a) return;
    if(a.dataset.a === 'del'){ await window.CendurRide.offline.remove(route.id); toast('Odebráno z telefonu.'); }
    else { a.disabled = true; const ok = await window.CendurRide.offline.save(route); if(ok) toast(a.dataset.a === 'upd' ? 'Roadbook v telefonu aktualizován.' : 'Roadbook je v telefonu – pojede i bez signálu.'); }
    renderDetailOffline(inner, route);
  };
}

// v4.15: přijedu k trase s roadbookem → nabídka Atlas NAVI | Roadbook | Ne (jednou; znovu až po vzdálení na 200 m)
// v4.54: nabídka se u trasy ukáže jednou; znovu až když od ní odjedu dál než 250 m a zůstanu
// dál aspoň 30 s (souběžná cesta kolem trasy ji tak nespouští pořád dokola). Mezi dvěma nabídkami
// (i u různých tras) aspoň 30 s.
const FREE_ASK_M = 40, FREE_ASK_RESET_M = 250, FREE_ASK_AWAY_MS = 30000, FREE_ASK_GAP_MS = 30000;
const freeAsked = new Map();   // id -> od kdy jsem od trasy daleko (0 = blízko)
let freeAskLast = 0;
function freeOffer(latlng){
  const RB = window.CendurRB;
  if(!RB || !freeSums || !navOn || !currentUser) return;
  const now = Date.now();
  [...freeAsked.keys()].forEach(id => {
    const r = routesCache[id];
    const far = !r || freeDistM(r, latlng[0], latlng[1], FREE_ASK_RESET_M + 100) > FREE_ASK_RESET_M;
    if(!far){ freeAsked.set(id, 0); return; }
    if(!freeAsked.get(id)) freeAsked.set(id, now);
    else if(now - freeAsked.get(id) > FREE_ASK_AWAY_MS) freeAsked.delete(id);
  });
  if(now - freeAskLast < FREE_ASK_GAP_MS) return;
  if(freePickedId != null || freeCaughtId == null || freeAsked.has(freeCaughtId)) return;
  if((window.CendurHeader && CendurHeader.askOpen()) || (window.CendurRide && CendurRide.isOpen())) return;
  const id = freeCaughtId, r = routesCache[id], st = RB.stateOf(freeSums[id]);
  if(!r || !freeSums[id] || st === 'auto') return;
  if(freeDistM(r, latlng[0], latlng[1], 100) > FREE_ASK_M) return;
  freeAsked.set(id, 0);
  freeAskLast = now;
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
      { icon:'📒', label:'Roadbook', sub:'velké instrukce, počítadlo', cls:'rb', fn: () => startRoadbook(id) },
      { label:'Ne', cls:'no', countdown:8 }
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
    if(!off){ freeProg = p.s; freeWasOn = true; freeOffSince = 0; if(!freePosPredicted) freeProgReal = p.s; }
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
        // v4.53: v Atlasu se po trase jezdí oběma směry – bez varování, jen se neukazuje karta s instrukcí
        // (na směru záleží až při jízdě podle roadbooku přes celou obrazovku, tam varování zůstává)
      } else {
        if(followed && guide()) freeGuide.update(rb.vis, p.s, currentSpeedKmh / 3.6, false);
        const nx = followed ? rb.vis.find(it=>it.s > p.s + 8) : null;   // v4.52: karta jen u sledované trasy
        if(nx) html = '<div class="fc-card">' + RB.tulipSVG(nx, 92) + '<div class="fc-d">' + RB.fmtDist(Math.max(0, nx.s - p.s)) + '</div><div class="fc-l">' + escapeHtml(RB.label(nx)) + '</div></div>';
      }
    } else if(off && followed && freeWasOn){
      // vyjel jsem ze sledované trasy → upozornění (jemný tón + „Jsi mimo trasu“)
      routeNote = { title:'Mimo trasu · ' + RB.fmtDist(p.dist), tone:'bad', prio:5 };
      // v4.49: daleko (500 m) nebo dlouho (1 min) mimo trasu → sledování trasy se samo vypne
      if(!freeOffSince) freeOffSince = Date.now();
      if(!freePosPredicted && (p.dist > FREE_GIVEUP_M || Date.now() - freeOffSince > FREE_GIVEUP_MS)){
        freeOffSince = 0;
        setTimeout(() => { if(freePickedId === id){ freePick(null); toast('Trasa opuštěna – pokračuje volná jízda.', 3500); } }, 0);
      }
      if(rb && guide()) freeGuide.update(rb.vis, freeProg, currentSpeedKmh / 3.6, true);
    }
  }
  if(routeNote) freeStatus.set('route', routeNote); else freeStatus.clear('route');
  box.innerHTML = html;
  placeRecPanel();
}

// Jedno tlačítko „Navigovat v Atlasu / Ukončit navigaci“ (dřív „Sleduji / Nesleduji polohu“):
//  zapnuto  = sledovat polohu + mapa natočená podle směru jízdy + silnější čáry tras
//  vypnuto  = mapa volně posouvatelná, sever nahoru, normální čáry (GPS a záznam běží dál)
// v4.58: opts.suspend = jen dočasně (jízda podle roadbooku) – GPS a Stopař se nechají běžet.
// Jinak „Ukončit navigaci“ ukončí i Stopaře (záznam se nabídne k uložení) a vypne GPS i kompas.
function setNavMode(on, opts){
  const fullEnd = !on && !(opts && opts.suspend);
  setTimeout(placeRecPanel, 60); setTimeout(placeRecPanel, 400);   // v4.49: lišta Stopaře podle režimu
  if(on){
    if(!requireLogin('navigaci')) return;
    if(!startGpsWatch()) return;
    navOn = true;
    followMode = true;
    enableCompass();
    requestWakeLock();
    headingMode = 'heading';
  } else {
    navOn = false;
    followMode = false;
    stopGlide(); setRotationGlide(150);
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
  if(fullEnd) endRideSession();
}
// v4.58: konec navigace = konec jízdy. Záznam Stopaře se nezahodí – zobrazí se okno Uložit / Zahodit / Pokračovat.
// Pak se vypne GPS a displej smí zhasnout (nic nebrání spánku a baterie se šetří).
function endRideSession(){
  if(rec.state !== 'idle'){
    if(rec.points.length < 2) recClear(); else openRideDialog();
  }
  if(rec.state !== 'recording'){ stopGpsWatch(); releaseWakeLock(); }
}

// v3.9.1: společné klepnutí (public/zoom.js) – spolehlivé i v rukavicích
window.CendurZoom.tap(locateBtn, ()=>{ if(!navOn && window.CendurSound) CendurSound.unlock(); setNavMode(!navOn); });

function startOrientation(){
  if(orientationBound) return;
  orientationBound = true;
  // v4.27: jen JEDEN zdroj kompasu. Android posílá „deviceorientationabsolute“ (skutečný sever)
  // i „deviceorientation“ (relativní úhel s náhodnou nulou) – míchání obou házelo šipkou o desítky
  // stupňů i v klidu. Bereme absolutní; relativní jen když je výslovně absolutní (nebo kompas iPhonu).
  let gotAbsolute = false, lastCompassTs = 0;
  const handler = (e, isAbs)=>{
    // Kompas telefonu bereme v potaz jen pod rychlostním prahem - nad ním má
    // přednost GPS kurz, který se zpracovává v onPosition().
    if(isAbs) gotAbsolute = true;
    else if(gotAbsolute) return;
    if(currentSpeedKmh > HEADING_SPEED_THRESHOLD_KMH) return;
    let heading = null;
    if(e.webkitCompassHeading != null) heading = e.webkitCompassHeading;          // iPhone
    else if(e.alpha != null && (isAbs || e.absolute === true)) heading = 360 - e.alpha;
    if(heading==null || isNaN(heading)) return;
    // v4.55: kompas měří směr horní hrany telefonu v jeho přirozené poloze (na výšku). Když je
    // obrazovka otočená (na šířku v držáku / v autě), musí se přičíst její otočení – jinak je
    // šipka po zastavení o 90° vedle.
    const scr = (screen.orientation && screen.orientation.angle != null) ? screen.orientation.angle : (+window.orientation || 0);
    heading = ((heading + scr) % 360 + 360) % 360;
    // vyhlazení podle času (ne podle počtu událostí) – telefony je posílají 5× i 60× za sekundu
    const now = performance.now();
    const dt = lastCompassTs ? Math.min(1000, now - lastCompassTs) : 16;
    lastCompassTs = now;
    const a = 1 - Math.exp(-dt / HEADING_COMPASS_TAU_MS);
    feedHeading(heading, a, HEADING_UPDATE_THRESHOLD_DEG_COMPASS, HEADING_MIN_UPDATE_MS_COMPASS);
  };
  orientAbs = e => handler(e, true);
  orientRel = e => handler(e, false);
  window.addEventListener('deviceorientationabsolute', orientAbs, true);
  window.addEventListener('deviceorientation', orientRel, true);
}
// v4.58: po ukončení navigace se kompas odpojí (senzor zbytečně běžel a bral baterii)
function stopOrientation(){
  if(orientAbs) window.removeEventListener('deviceorientationabsolute', orientAbs, true);
  if(orientRel) window.removeEventListener('deviceorientation', orientRel, true);
  orientAbs = orientRel = null;
  orientationBound = false;
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
// v4.54: náklon 20° (dřív 30°) a delší perspektiva – při 30° musela být mapa kvůli horizontu
// obří (~2300 × 2300 px, na telefonu přes 40 Mpx), grafika ji nestíhala držet: problikávání,
// šedé díry v mapě, mizející ovládání, horký telefon
const TILT_MAX_DEG = 20;
const TILT_FROM_KMH = 25, TILT_TO_KMH = 35;
let tiltCur = 0, tiltTarget = 0, tiltRaf = 0, tiltLayout = false, tiltLowSince = 0;
function tiltForSpeed(kmh){
  const t = Math.min(1, Math.max(0, (kmh - TILT_FROM_KMH) / (TILT_TO_KMH - TILT_FROM_KMH)));
  return t * t * (3 - 2 * t) * TILT_MAX_DEG;
}
function tiltPerspective(){ return Math.round(Math.max(window.innerWidth, window.innerHeight) * 1.6); }
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
    // v4.28: „rozbalený“ úhel – přes sever (359° → 1°) se mapa otočí kratší cestou, ne celé kolo
    if(!navManualActive()) mapRotDeg = mapRotDeg + angleDiff(displayedHeading, mapRotDeg);
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
    arrowShownDeg = null;
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
  if(document.visibilityState === 'visible' && currentUser && (navOn || rec.state === 'recording')) requestWakeLock();
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
  if(recBtnLabel) recBtnLabel.textContent = rec.state==='recording' ? 'Nahrávám…' : rec.state==='paused' ? 'Pozastaveno' : 'Stopař';
  if(recPanel){
    recPanel.classList.toggle('open', active && !recPanelHidden);
    recPanel.classList.toggle('paused', rec.state==='paused');
  }
  placeRecPanel();
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
  if(!navOn){ stopGpsWatch(); releaseWakeLock(); }
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
  if(!navOn){ stopGpsWatch(); releaseWakeLock(); }
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
      if(currentUser) currentUser.ownRoutes = (currentUser.ownRoutes || 0) + 1;
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
// v4.76: místo z Komunity (Místa, Akce) označené v Atlasu; text bez souřadnic se dohledá přes Mapy.com
let sharedPin = null;
async function showSharedPlace(bod, misto, nazev){
  let pt = null;
  const m = bod && bod.split(',').map(Number);
  if(m && m.length === 2 && isFinite(m[0]) && isFinite(m[1]) && Math.abs(m[0]) <= 90 && Math.abs(m[1]) <= 180) pt = m;
  else if(misto){
    try{
      const key = (window.CendurMaps && CendurMaps.MAPY_KEY) || '';
      const r = await fetch('https://api.mapy.com/v1/geocode?lang=cs&limit=1&query=' + encodeURIComponent(misto) + '&apikey=' + key);
      const j = await r.json(), pos = j && j.items && j.items[0] && j.items[0].position;
      if(pos) pt = [pos.lat, pos.lon];
    }catch(e){}
  }
  if(!pt){ toast('Místo „' + (misto || bod) + '“ se nepodařilo najít na mapě.', 5000); return; }
  map.setView(pt, 15);
  if(sharedPin) sharedPin.remove();
  sharedPin = destMakePin(pt);
  CendurHeader.ask({
    title: nazev || 'Místo',
    msg: misto && !bod ? misto : pt[0].toFixed(5) + ', ' + pt[1].toFixed(5),
    choices: [
      { label:'Navigovat sem offroadem', sub:'po stezkách a značených cestách', cls:'atlas', fn: () => { if(requireLogin('navigaci')) destStart(pt, 'teren'); } },
      { label:'Navigovat sem po cestách', sub:'po silnicích, nejkratší cesta', cls:'rb', fn: () => { if(requireLogin('navigaci')) destStart(pt, 'silnice'); } },
      { label:'Zavřít', cls:'no', fn: () => {} }
    ]
  });
}

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
    if(window.CendurOsmPoints) CendurOsmPoints.attach(map, layerMenu);
    if(window.CendurRouteAlpha) CendurRouteAlpha.attach(layerMenu);
  }
  positionFloatingMapButtons();
  setTimeout(positionFloatingMapButtons, 100);
  await loadRoutes();
  // „+ Nahrát trasu“ z GPX planneru → index.html?nahrat=1
  try{
    const u = new URL(location.href);
    if(u.searchParams.get('nahrat')){
      u.searchParams.delete('nahrat'); history.replaceState(null, '', u);
      document.getElementById('open-upload')?.click();
    }
  }catch(e){}
  // v4.76: „na mapě“ z Komunity → index.html?bod=lat,lon (nebo ?misto=text) &nazev=… : mapa přeletí na místo a označí ho
  try{
    const u = new URL(location.href), bod = u.searchParams.get('bod'), misto = u.searchParams.get('misto'), nazev = u.searchParams.get('nazev') || '';
    if(bod || misto){
      ['bod','misto','nazev'].forEach(k => u.searchParams.delete(k)); history.replaceState(null, '', u);
      showSharedPlace(bod, misto, nazev);
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
  rbAfterLogin();   // v4.26: „Přihlásit se“ ze simulace roadbooku → po přihlášení rovnou jízda
}

(async function boot(){
  try{
    const user = await api('/api/auth/me');
    currentUser = user;
    if(user.mustChangePassword){ location.replace('nastaveni.html?zmena=1'); return; }
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
