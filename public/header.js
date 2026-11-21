// ---------------------------------------------------------------
// Společná hlavička pro Atlas (index.html), Plánovač (planovac.html), Merch (merch.html)
// a od v2.0 i Roadbook editor / Roadbook NAVI. Stránky jsou v dlaždicovém menu přes celou obrazovku.
//
// Na stránce stačí prázdný <header class="topbar" data-page="atlas|planovac|merch"></header>
// a načíst tento skript (po public/config.js). Skript doplní:
//   - logo + název stránky u loga,
//   - dlaždice (v4.18): ATLAS (mapa, navigace, roadbook, stopař) | příprava: 1 GPX planner → 2 Roadbook editor
//     | Nastavení účtu · FAQ · Merch (aktivní stránka má zlatý obrys); Roadbook NAVI se spouští z Atlasu,
//   - tlačítko „+ Nahrát trasu“ (Atlas a GPX planner), „O projektu“ a tlačítko uživatele,
//   - okno „O projektu“ a okno „Nastavení účtu“ (změna hesla + odhlášení).
// Stránka pak zavolá CendurHeader.setUser(user) – nebo setUser(null) pro nepřihlášeného.
// Merch si přihlášení ověří sám (data-auth="auto").
// ---------------------------------------------------------------
(function(){
    const API_URL = window.CENDUROFF_API_URL || 'https://api.cenduroff.cz'; // prázdná/chybějící adresa = Railway
  const header = document.querySelector('header.topbar[data-page]');
  if(!header) return;
  const page = header.dataset.page;
  // pořadí v nabídce: Atlas | Roadbook | Merch + FAQ (skupiny oddělené čárou)
  const PAGES = [
    { id:'atlas',    label:'Atlas',         href:'index.html' },
    { id:'planovac', label:'GPX planner', href:'planovac.html' }
  ];
  // stránky Roadbooku (v2.0)
  const MENU_PAGES = [
    { id:'roadbook',      label:'Roadbook editor',  href:'roadbook-planner.html' }
    // v4.26: Roadbook NAVI už není samostatná stránka – jízda podle roadbooku se otevírá v Atlasu (public/rb-ride.js)
  ];
  const HELP_PAGES = [
    { id:'komunita', label:'Komunita',      href:'komunita.html' },
    { id:'merch', label:'Merch',          href:'merch.html' },
    { id:'faq',   label:'Nápověda', href:'faq.html' }
  ];
  // v2.9: Admin sekce není v Menu – je v okně uživatele (vedle „Odhlásit se“), jen pro adminy
  const ADMIN_PAGE = { id:'admin', label:'Admin sekce', href:'admin.html' };
  const ALL_PAGES = PAGES
    .concat(MENU_PAGES.map((p, i)=>Object.assign({ sep: i === 0 }, p)))
    .concat(HELP_PAGES.map((p, i)=>Object.assign({ sep: i === 0 }, p)));
  // v3.2: Nastavení účtu je samostatná stránka (nastaveni.html)
  const SETTINGS_PAGE = { id:'nastaveni', label:'Nastavení účtu', href:'nastaveni.html' };
  const current = ALL_PAGES.find(p=>p.id===page) || (page === 'admin' ? ADMIN_PAGE : page === 'nastaveni' ? SETTINGS_PAGE : PAGES[0]);

  // v2.11: hlavička je jen tenký pruh – „← Zpět“ na dlaždice, název stránky a tlačítka stránky.
  // Všechny stránky, účet, FAQ a nahrání trasy jsou v dlaždicovém menu přes celou obrazovku.
  header.innerHTML = `
    <a class="brand-link" href="#" id="hdr-brand" title="Úvodní dlaždice">
      <img class="brand-logo" src="public/img/pms-logo.png" alt="">
      <span class="brand">CendurOFF <span class="brand-sub">${current.label}</span></span>
    </a>
    <div class="site-actions">
      ${page==='atlas' || page==='planovac' ? '<button class="btn solid hdr-up" id="open-upload" type="button">+ Nahrát<span class="hdr-up-l">${page==='planovac' ? ' GPX' : ' trasu'}</span></button>' : ''}
      <button class="btn hdr-back" id="hdr-back" type="button" aria-label="Zpět na úvodní dlaždice">← Zpět</button>
      <button class="btn" id="open-about" type="button" hidden>O projektu</button>
      <button class="btn user-btn hdr-wide" id="user-chip" type="button" hidden></button>
      <a class="btn hdr-wide" id="login-link" href="index.html${page==='atlas' ? '?atlas=1' : '?next=' + encodeURIComponent(current.href)}" hidden>Přihlásit se</a>
    </div>`;

  // --- dlaždicové menu přes celou obrazovku ---
  if(!document.getElementById('nav-menu-style')){
    document.head.insertAdjacentHTML('beforeend', `<style id="nav-menu-style">
      header.topbar{flex-wrap:nowrap;}
      .hdr-back{flex:none;font-weight:700;}
      .hdr-up{flex:none;white-space:nowrap;}
      @media (max-width:760px){ .hdr-up-l{display:none;} }
      header.topbar .brand-link{min-width:0;overflow:hidden;}
      header.topbar .brand{overflow:hidden;text-overflow:ellipsis;}
      header.topbar .site-actions{flex-wrap:nowrap;margin-left:auto;}
      @media (max-width:760px){ header.topbar .hdr-wide{display:none !important;} header.topbar .site-actions{display:flex;} }
      #tile-menu{position:fixed;inset:0;z-index:5000;background:#101810;color:#EFEAD8;display:none;
        padding:calc(env(safe-area-inset-top,0px) + 12px) calc(env(safe-area-inset-right,0px) + 12px) calc(env(safe-area-inset-bottom,0px) + 12px) calc(env(safe-area-inset-left,0px) + 12px);
        box-sizing:border-box;font-family:'Roboto',sans-serif;}
      #tile-menu.open{display:grid;}
      #tile-menu{grid-template-columns:1fr;grid-template-rows:auto auto 1fr auto 1fr auto;gap:10px;}
      .tm-head{display:flex;align-items:center;gap:10px;}
      .tm-head img{height:34px;border-radius:5px;}
      .tm-head b{font-family:'Exo 2',sans-serif;font-size:1.35rem;font-weight:700;}
      .tm-head span{margin-left:auto;font-size:0.82rem;color:#C9B87A;text-align:right;}
      .tm-head .tm-uv{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:1px;}
      .tm-head .tm-uv span{margin-left:0;}
      .tm-ver{font-size:0.68rem;color:#8E9A86;letter-spacing:0.02em;}
      .tm-ver a{color:#F5D36A;font-weight:700;text-decoration:none;}
      .tm-lbl{font-size:0.78rem;letter-spacing:0.12em;color:#C9B87A;font-weight:700;margin:2px 2px -4px;}
      .tm-grp{display:grid;grid-template-columns:1fr 1fr;gap:10px;min-height:0;}
      .tm-tile{border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
        gap:4px;padding:10px;text-decoration:none;font-family:'Exo 2',sans-serif;font-weight:800;font-size:1.25rem;line-height:1.1;
        border:3px solid transparent;box-sizing:border-box;min-height:0;}
      .tm-tile small{font-family:'Roboto',sans-serif;font-weight:500;font-size:0.8rem;opacity:.9;}
      .tm-tile.cur{border-color:#F1D79A;box-shadow:0 0 0 2px #101810 inset;}
      .tm-tile:active{filter:brightness(1.1);}
      .tm-an{background:#4F7048;color:#fff;font-size:1.7rem;letter-spacing:0.06em;} .tm-an small{letter-spacing:normal;font-size:0.9rem;} .tm-ap{background:#3B5636;color:#fff;}
      .tm-rp{background:#C99400;color:#111;}
      .tm-grp.tm-one{grid-template-columns:1fr !important;}
      /* příprava: 1 → 2 (šipka mezi dlaždicemi) */
      .tm-steps{position:relative;}
      .tm-steps::after{content:'→';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;
        background:#101810;color:#F1D79A;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;pointer-events:none;}
      .tm-tile .tm-n{display:inline-flex;align-items:center;justify-content:center;width:1.6em;height:1.6em;border-radius:50%;font-size:0.8rem;
        background:rgba(0,0,0,.25);margin-bottom:2px;}
      .tm-side{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
      .tm-s{border-radius:10px;background:#26342A;border:1px solid #3A4A3C;color:#EFEAD8;display:flex;align-items:center;justify-content:center;
        text-align:center;padding:12px 8px;font-weight:700;font-size:0.98rem;text-decoration:none;font-family:inherit;cursor:pointer;min-height:48px;box-sizing:border-box;}
      .tm-s.cur{border-color:#F1D79A;}
      /* na šířku: nahoře ATLAS přes dva sloupce, pod ním příprava (1 → 2); vpravo podélné dlaždice
         začínající ve stejné linii jako ATLAS */
      @media (orientation:landscape){
        #tile-menu.open{grid-template-columns:1fr 1fr minmax(150px,0.62fr);grid-template-rows:auto auto 1fr auto 1fr;gap:8px 10px;}
        .tm-head{grid-column:1 / -1;}
        .tm-col{display:contents;}
        .tm-col .tm-lbl{grid-column:1 / 3;margin:0 2px;}
        .tm-col .tm-grp{grid-column:1 / 3;grid-template-columns:1fr 1fr;}
        #tile-menu > .tm-col:nth-child(2) > .tm-lbl{grid-row:2;}
        #tile-menu > .tm-col:nth-child(2) > .tm-grp{grid-row:3;}
        #tile-menu > .tm-col:nth-child(3) > .tm-lbl{grid-row:4;}
        #tile-menu > .tm-col:nth-child(3) > .tm-grp{grid-row:5;}
        .tm-side{grid-column:3;grid-row:3 / 6;grid-template-columns:1fr;grid-auto-rows:1fr;}
      }
      @media (orientation:portrait){ .tm-col{display:contents;} }
    </style>`);
  }
  if(!document.getElementById('tile-menu')){
    const T = (cls, id, href, title, sub) =>
      `<a class="tm-tile ${cls}${id===page ? ' cur' : ''}" href="${href}" data-page="${id}">${title}${sub ? '<small>' + sub + '</small>' : ''}</a>`;
    document.body.insertAdjacentHTML('beforeend', `
<div id="tile-menu" role="dialog" aria-modal="true" aria-label="Menu CendurOFF">
  <div class="tm-head"><img src="public/img/pms-logo.png" alt=""><b>CendurOFF</b><div class="tm-uv"><span id="tm-user"></span><small class="tm-ver" id="tm-ver"></small></div></div>
  <div class="tm-col"><div class="tm-lbl">JÍZDA</div><div class="tm-grp tm-one">
    ${T('tm-an','atlas','index.html','ATLAS','mapa, navigace, roadbook, stopař')}
  </div></div>
  <div class="tm-col"><div class="tm-lbl">PŘÍPRAVA TRASY</div><div class="tm-grp tm-steps">
    ${T('tm-ap','planovac','planovac.html','<span class="tm-n">1</span>GPX planner','naplánuj, uprav nebo nahraj trasu')}
    ${T('tm-rp','roadbook','roadbook-planner.html','<span class="tm-n">2</span>Roadbook editor','vytvoř k trase roadbook · jen na PC')}
  </div></div>
  <div class="tm-side">
    <a class="tm-s${page==='komunita' ? ' cur' : ''}" href="komunita.html">Komunita</a>
    <button class="tm-s${page==='nastaveni' ? ' cur' : ''}" id="tm-account" type="button">Nastavení účtu</button>
    <a class="tm-s${page==='faq' ? ' cur' : ''}" href="faq.html">Nápověda</a>
    <a class="tm-s${page==='merch' ? ' cur' : ''}" href="merch.html">Merch</a>
  </div>
</div>`);
  }
  const tiles = document.getElementById('tile-menu');
  // v3.0: dlaždice jsou úvodní stránka webu i aplikace = index.html bez parametrů.
  // Atlas NAVI má adresu index.html?atlas=1 (sdílené odkazy ?trasa=… a přihlášení ?next=… vedou rovnou do Atlasu).
  const ATLAS_URL = 'index.html?atlas=1';
  const isHomeUrl = () => page === 'atlas' && !location.search && !location.hash;
  let tilesPushed = false, tilesHome = false;
  function openTiles(){
    if(tiles.classList.contains('open')) return;
    tiles.classList.add('open');
    appVersionInfo();
    // tlačítko Zpět v telefonu zavře dlaždice (vrátí na stránku)
    try{ history.pushState({ cendurTiles: 1 }, ''); tilesPushed = true; }catch(e){}
  }
  function openHome(){
    tilesHome = true; tilesPushed = false;
    tiles.classList.add('open', 'home');
    setTimeout(appVersionInfo, 400);
  }
  function closeTiles(fromPop){
    if(!tiles.classList.contains('open') || tilesHome) return;
    tiles.classList.remove('open');
    if(tilesPushed && !fromPop){ tilesPushed = false; try{ history.back(); }catch(e){} }
    tilesPushed = false;
  }
  // z úvodu (index.html) do Atlasu bez nového načítání stránky – Atlas už pod dlaždicemi běží
  function leaveHomeToAtlas(){
    tilesHome = false;
    tiles.classList.remove('open', 'home');
    try{ history.pushState(null, '', ATLAS_URL); }catch(e){}
    window.dispatchEvent(new Event('resize'));
  }
  window.addEventListener('popstate', ()=>{
    if(isHomeUrl()){ openHome(); return; }            // Zpět v telefonu z Atlasu → úvodní dlaždice
    if(tiles.classList.contains('open')) closeTiles(true);
  });
  document.getElementById('hdr-back').addEventListener('click', openTiles);
  document.getElementById('hdr-brand').addEventListener('click', e=>{ e.preventDefault(); openTiles(); });
  // dlaždice aktuální stránky = jen zavřít menu
  tiles.querySelectorAll('[data-page]').forEach(a=>{
    if(a.dataset.page === 'atlas') a.setAttribute('href', ATLAS_URL);
    a.addEventListener('click', e=>{
      if(a.dataset.page !== page) return;
      e.preventDefault();
      if(tilesHome) leaveHomeToAtlas(); else closeTiles();
    });
  });
  tiles.querySelectorAll('a.tm-s').forEach(a=> a.addEventListener('click', e=>{
    if(a.classList.contains('cur')){ e.preventDefault(); closeTiles(); }
  }));
  // v4.18: „+ Nahrát trasu“ v GPX planneru otevře nahrání v Atlasu (stejné okno jako v Atlasu)
  // v4.92: v plánovači „+ Nahrát GPX“ otevře soubor z zařízení do plánovače (neukládá se, dokud neklepneš na Uložit)
  if(page !== 'atlas'){
    const up = document.getElementById('open-upload');
    if(up) up.addEventListener('click', ()=>{
      const f = page === 'planovac' && document.getElementById('pl-gpx-file');
      if(f) f.click(); else location.href = 'index.html?nahrat=1';
    });
  }
  // v3.2: Nastavení účtu = samostatná stránka nastaveni.html
  document.getElementById('tm-account').addEventListener('click', ()=>{
    if(!user){ goLogin(); return; }
    if(page === 'nastaveni'){ closeTiles(); return; }
    location.href = 'nastaveni.html';
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && tiles.classList.contains('open') && !document.querySelector('.modal-overlay.open')) closeTiles(); });

  // úvodní stránka: index.html bez parametrů = dlaždice
  if(isHomeUrl()) openHome();

  // --- okna (vloží se jen jednou) ---
  if(!document.getElementById('about-overlay')){
    document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" id="about-overlay">
  <div class="modal about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
    <button class="detail-close" id="about-close" type="button" aria-label="Zavřít">×</button>
    <img class="about-logo" src="public/img/pms-logo.png" alt="CendurOFF">
    <h2 id="about-title">O projektu</h2>
    <p class="sub">CendurOFF vytvořila a spravuje parta <strong>Petrol Machine Silesia</strong> —
      skupina lidí, které baví offroad, enduro a objevování tras, které nenajdete na žádné
      turistické mapě.</p>
    <p class="sub">Cílem je vytvořit offroad atlas, kam si každý může nahrát vlastní GPX trasu, ukázat
      ji ostatním a přidat pár fotek z cesty.</p>
    <p class="sub">S připomínkami a nápady na vylepšení nás můžete kontaktovat na našem Facebooku
      <a href="https://www.facebook.com/PetrolMachineSilesia" target="_blank" rel="noopener">Petrol Machine Silesia</a>
      nebo na e-mailu <a href="mailto:petrol.machine@gmail.com">petrol.machine@gmail.com</a>.</p>
    <p class="sub about-soon">Pokud se ti náš projekt líbí, můžeš nás podpořit třeba nákupem
      <a href="merch.html">merche nebo samolepek CendurOFF</a>.</p>
  </div>
</div>`);
  }

  const aboutOverlay = document.getElementById('about-overlay');
  const userBtn = document.getElementById('user-chip');
  const loginLink = document.getElementById('login-link');
  let user = null;
  // v4.2: přihlášení – v Atlasu nad mapou (window.CendurLogin z app.js), jinde přes Atlas a zpět sem
  function goLogin(){
    if(typeof window.CendurLogin === 'function'){ closeTiles(); window.CendurLogin(); return; }
    location.href = page === 'atlas' ? 'index.html?login=1' : 'index.html?next=' + encodeURIComponent(current.href);
  }
  if(loginLink) loginLink.addEventListener('click', e=>{ e.preventDefault(); goLogin(); });

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
  function closeOnBackdrop(overlay){ overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.classList.remove('open'); }); }

  document.getElementById('open-about').addEventListener('click', ()=> aboutOverlay.classList.add('open'));
  document.getElementById('about-close').addEventListener('click', ()=> aboutOverlay.classList.remove('open'));
  closeOnBackdrop(aboutOverlay);

  userBtn.addEventListener('click', ()=>{
    if(!user) return;
    if(page !== 'nastaveni') location.href = 'nastaveni.html';
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') aboutOverlay.classList.remove('open'); });

  function setUser(u){
    user = u || null;
    if(user && user.mustChangePassword && page !== 'nastaveni'){ location.replace('nastaveni.html?zmena=1'); return; }   // v4.60: dočasné heslo
    userBtn.hidden = !user;
    loginLink.hidden = !!user;
    if(user) userBtn.textContent = user.displayName + ({ admin:' · admin', moderator:' · moderátor', reporter:' · reporter' }[user.role] || '');
    const tu = document.getElementById('tm-user');
    if(tu) tu.textContent = user ? user.displayName + ({ admin:' · admin', moderator:' · moderátor', reporter:' · reporter' }[user.role] || '') : '';
    const ta = document.getElementById('tm-account');
    if(ta) ta.textContent = user ? 'Nastavení účtu' : 'Přihlásit se';
    window.dispatchEvent(new Event('resize')); // hlavička mohla změnit výšku (mobil)
  }

  // v4.20: verze v rohu úvodních dlaždic (web · aplikace) a kontrola nové verze aplikace pro Android
  //  nejnovější verzi říká download/app-version.json ({"version":"3.0"}) – mění se spolu s download/CendurOFF.apk
  // jiná doména (GitHub raw) → stáhne Chrome (i aplikace 3.0); název souboru je ve verzi: download/app-version.json → apk
  const APK_BASE = 'https://github.com/Casari704/CendurOFF/raw/main/download/';
  const apkUrl = d => APK_BASE + ((d && d.apk) || 'CendurOFF.apk');
  const verCmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for(let i = 0; i < Math.max(x.length, y.length); i++){ const d = (x[i] || 0) - (y[i] || 0); if(d) return d; } return 0; };
  function appVersionInfo(){
    const el = document.getElementById('tm-ver'); if(!el) return;
    let app = null; try{ if(window.CendurApp && window.CendurApp.version) app = String(window.CendurApp.version()); }catch(e){}
    const web = window.CENDUROFF_WEB_VERSION || '';
    el.textContent = 'web ' + web + (app ? ' · aplikace ' + app : '');
    if(!app) return;
    fetch('download/app-version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if(!d || !d.version || verCmp(d.version, app) <= 0) return;
      el.innerHTML = '';
      el.append('web ' + web + ' · aplikace ' + app + ' · ');
      const a = document.createElement('a'); a.href = apkUrl(d); a.textContent = '⬆ nová ' + d.version; el.append(a);
      // nabídka jednou za verzi, jen na úvodních dlaždicích (ne při jízdě)
      let seen = null; try{ seen = localStorage.getItem('cenduroff.appUpdateAsked'); }catch(e){}
      if(seen === d.version || !tilesHome) return;
      try{ localStorage.setItem('cenduroff.appUpdateAsked', d.version); }catch(e){}
      ask({ title: 'Nová verze aplikace ' + d.version, msg: 'Máš verzi ' + app + '. Stáhni novou a nainstaluj ji přes starou – účet i nastavení zůstanou.',
        yes: { label: 'Stáhnout', fn: () => { location.href = apkUrl(d); } }, no: { label: 'Později' } });
    }).catch(() => {});
  }

  // v4.84: povinná aktualizace aplikace + odkazy ke stažení s aktuálním názvem souboru (data-apk)
  //  app-version.json: { "version":"3.3", "apk":"CendurOFF-3.3.apk", "min":"3.3" (volitelné; jinak platí version) }
  //  aplikace se starší verzí dostane okno bez možnosti pokračovat; bez signálu (nejde stáhnout JSON) se nic neblokuje
  (function enforceApp(){
    fetch('download/app-version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if(!d || !d.version) return;
      document.querySelectorAll('a[data-apk]').forEach(a => { if(d.apk){ a.href = 'download/' + d.apk; if(a.classList.contains('f-dl')) a.textContent = '⬇ Stáhnout ' + d.apk; } });
      let app = null; try{ if(window.CendurApp && window.CendurApp.version) app = String(window.CendurApp.version()); }catch(e){}
      if(!app || verCmp(d.min || d.version, app) <= 0) return;
      if(document.getElementById('c-force')) return;
      const el = document.createElement('div');
      el.id = 'c-force'; el.className = 'c-ask'; el.style.zIndex = '99999'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = '<div class="c-ask-box"><b>Je potřeba aktualizovat aplikaci</b><p class="c-ask-msg"></p><div class="c-ask-row"><button type="button" class="c-ask-yes">Stáhnout aktualizaci</button></div></div>';
      el.querySelector('.c-ask-msg').textContent = 'Máš verzi ' + app + ', aktuální je ' + d.version + '. Stáhni novou a nainstaluj ji přes starou – účet i nastavení zůstanou.';
      el.querySelector('.c-ask-yes').addEventListener('click', () => { location.href = apkUrl(d); });
      document.body.appendChild(el);
    }).catch(() => {});
  })();

  // v4.3.1: sdílené potvrzovací okno (Atlas i Roadbook NAVI) – titulek, text, 1–2 tlačítka a křížek
  //  ask({ title, msg, icon, list:[{icon,name,desc}], yes:{label, fn}, no:{label, fn}, onClose })
  let askEl = null, askOpts = null, askAt = 0, askTimer = 0;
  function askClose(viaX){
    if(askTimer){ clearInterval(askTimer); askTimer = 0; }
    if(!askEl || askEl.hidden) return;
    askEl.hidden = true;
    const o = askOpts; askOpts = null;
    if(viaX && o && o.onClose) o.onClose();
  }
  function ask(o){
    if(!askEl){
      askEl = document.createElement('div');
      askEl.className = 'c-ask'; askEl.hidden = true;
      askEl.setAttribute('role', 'dialog'); askEl.setAttribute('aria-modal', 'true'); askEl.setAttribute('aria-labelledby', 'c-ask-t');
      askEl.innerHTML = '<div class="c-ask-box"><button type="button" class="c-ask-x" aria-label="Zavřít">×</button>' +
        '<div class="c-ask-icon" hidden></div><b id="c-ask-t"></b><p class="c-ask-msg"></p><ul class="c-ask-list" hidden></ul><div class="c-ask-choices" hidden></div><div class="c-ask-row"><button type="button" class="c-ask-yes"></button><button type="button" class="c-ask-no"></button></div></div>';
      document.body.appendChild(askEl);
      askEl.querySelector('.c-ask-x').addEventListener('click', () => askClose(true));
      // klik do tmavého pozadí zavře – ale ne „dojezd“ ťuknutí, které okno právě otevřelo
      askEl.addEventListener('click', e => { if(e.target === askEl && Date.now() - askAt > 600) askClose(true); });
      document.addEventListener('keydown', e => { if(e.key === 'Escape') askClose(true); });
      ['yes', 'no'].forEach(k => askEl.querySelector('.c-ask-' + k).addEventListener('click', () => {
        const fn = askOpts && askOpts[k] && askOpts[k].fn; askClose(false); if(fn) fn();
      }));
    }
    // nové okno nahradí případné otevřené (bez onClose toho starého)
    if(askTimer){ clearInterval(askTimer); askTimer = 0; }
    askOpts = o || {};
    askEl.querySelector('#c-ask-t').textContent = askOpts.title || '';
    askEl.querySelector('.c-ask-msg').textContent = askOpts.msg || '';
    // v4.4: velká ikona nahoře (odznaky) a seznam položek { icon, name, desc }
    const ic = askEl.querySelector('.c-ask-icon'); ic.hidden = !askOpts.icon; ic.textContent = askOpts.icon || '';
    const ul = askEl.querySelector('.c-ask-list'); const items = Array.isArray(askOpts.list) ? askOpts.list : [];
    ul.hidden = !items.length; ul.innerHTML = '';
    items.forEach(it => { const li = document.createElement('li'); li.innerHTML = '<span></span><div><b></b><small></small></div>';
      li.querySelector('span').textContent = it.icon || ''; li.querySelector('b').textContent = it.name || ''; li.querySelector('small').textContent = it.desc || ''; ul.appendChild(li); });
    askEl.classList.toggle('c-ask-badge', !!askOpts.icon);
    // v4.15: víc velkých voleb pod sebou / vedle sebe (na šířku) – choices:[{icon, label, sub, cls, fn}]
    const ch = askEl.querySelector('.c-ask-choices'); const chs = Array.isArray(askOpts.choices) ? askOpts.choices : [];
    ch.hidden = !chs.length; ch.innerHTML = '';
    chs.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'c-ask-ch' + (c.cls ? ' ' + c.cls : '');
      b.innerHTML = '<span class="c-ask-ch-i"></span><span class="c-ask-ch-t"><b></b><small></small></span>';
      b.querySelector('.c-ask-ch-i').textContent = c.icon || ''; b.querySelector('b').textContent = c.label || ''; b.querySelector('small').textContent = c.sub || '';
      b.addEventListener('click', () => { if(Date.now() - askAt < 350) return; askClose(false); if(c.fn) c.fn(); });
      ch.appendChild(b);
      // v4.15: odpočet v tlačítku („Ne · 10“) – po doběhnutí se okno samo zavře, jako by se klepnulo
      if(c.countdown > 0){
        let left = Math.round(c.countdown); const t = b.querySelector('b');
        const show = () => { t.textContent = (c.label || '') + ' · ' + left; };
        show();
        if(askTimer) clearInterval(askTimer);
        askTimer = setInterval(() => { left--; if(left > 0){ show(); return; } askClose(false); if(c.fn) c.fn(); }, 1000);
      } });
    // v4.85: řádky s titulkem a dvojicí tlačítek – rows:[{ title, sub, buttons:[{ label, cls, fn }] }] (+ závěrečné „Zrušit“ = cancel)
    const rows = Array.isArray(askOpts.rows) ? askOpts.rows : [];
    if(rows.length){
      ch.hidden = false; ch.innerHTML = '';
      rows.forEach(r => {
        const w = document.createElement('div'); w.className = 'c-ask-rw';
        const h = document.createElement('div'); h.className = 'c-ask-rw-h';
        const t = document.createElement('b'); t.textContent = r.title || ''; h.appendChild(t);
        if(r.sub){ const s = document.createElement('small'); s.textContent = r.sub; h.appendChild(s); }
        w.appendChild(h);
        const bs = document.createElement('div'); bs.className = 'c-ask-rw-b';
        (r.buttons || []).forEach(c => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'c-ask-rwb' + (c.cls ? ' ' + c.cls : ''); b.textContent = c.label || '';
          b.addEventListener('click', () => { if(Date.now() - askAt < 350) return; askClose(false); if(c.fn) c.fn(); });
          bs.appendChild(b);
        });
        w.appendChild(bs); ch.appendChild(w);
      });
      const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'c-ask-rwc'; cb.textContent = (askOpts.cancel && askOpts.cancel.label) || 'Zrušit';
      cb.addEventListener('click', () => { askClose(true); });
      ch.appendChild(cb);
    }
    askEl.classList.toggle('c-ask-rows', !!rows.length);
    askEl.classList.toggle('c-ask-multi', !!chs.length || !!rows.length);
    askEl.querySelector('.c-ask-row').hidden = !!chs.length || !!rows.length;
    const y = askEl.querySelector('.c-ask-yes'), n = askEl.querySelector('.c-ask-no');
    y.textContent = askOpts.yes ? askOpts.yes.label : 'OK';
    n.hidden = !askOpts.no; n.textContent = askOpts.no ? askOpts.no.label : '';
    askEl.querySelector('.c-ask-row').classList.toggle('one', !askOpts.no);
    askEl.hidden = false; askAt = Date.now();
    try{ ((chs.length || rows.length) ? ch.querySelector('button') : y).focus({ preventScroll:true }); }catch(e){}
  }
  const askOpen = () => !!(askEl && !askEl.hidden);

  window.CendurHeader = { setUser, page, openTiles, closeTiles, ask, askClose: () => askClose(false), askOpen };

  if(header.dataset.auth === 'auto'){
    api('/api/auth/me').then(setUser).catch(()=> setUser(null));
  }
})();
