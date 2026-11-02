// ---------------------------------------------------------------
// Společná hlavička pro Atlas (index.html), Plánovač (planovac.html), Merch (merch.html)
// a od v2.0 i Roadbook planner / Roadbook NAVI. Všechny stránky jsou v jedné rolovací nabídce „Menu ▾“.
//
// Na stránce stačí prázdný <header class="topbar" data-page="atlas|planovac|merch"></header>
// a načíst tento skript (po public/config.js). Skript doplní:
//   - logo + název stránky u loga,
//   - rolovací nabídka „Menu ▾“: Atlas · Plánovač · Merch · Roadbook planner · Roadbook NAVI
//     (vždy stejné pořadí a názvy, aktivní stránka má zlatý obrys),
//   - tlačítko „+ Nahrát trasu“ (jen v Atlasu), „O projektu“ a tlačítko uživatele,
//   - okno „O projektu“ a okno „Můj účet“ (změna hesla + odhlášení).
// Stránka pak zavolá CendurHeader.setUser(user) – nebo setUser(null) pro nepřihlášeného.
// Merch si přihlášení ověří sám (data-auth="auto").
// ---------------------------------------------------------------
(function(){
    const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app'; // prázdná/chybějící adresa = Railway
  const header = document.querySelector('header.topbar[data-page]');
  if(!header) return;
  const page = header.dataset.page;
  const PAGES = [
    { id:'atlas',    label:'Atlas',    href:'index.html' },
    { id:'planovac', label:'Plánovač', href:'planovac.html' },
    { id:'merch',    label:'Merch',    href:'merch.html' }
  ];
  // stránky Roadbooku (v2.0)
  const MENU_PAGES = [
    { id:'roadbook',      label:'Roadbook planner', href:'roadbook-planner.html' },
    { id:'roadbook-navi', label:'Roadbook NAVI',    href:'roadbook-navi.html' }
  ];
  // všechny stránky v jedné rolovací nabídce (od v2.0), roadbook oddělený čárou
  const ALL_PAGES = PAGES.concat(MENU_PAGES.map((p, i)=>Object.assign({ sep: i === 0 }, p)));
  const current = ALL_PAGES.find(p=>p.id===page) || PAGES[0];

  header.innerHTML = `
    <a class="brand-link" href="index.html" title="CendurOFF Atlas">
      <img class="brand-logo" src="public/img/pms-logo.png" alt="">
      <span class="brand">CendurOFF <span class="brand-sub">${current.label}</span></span>
    </a>
    <nav class="site-nav" aria-label="Hlavní menu">
      <div class="nav-menu">
        <button class="btn nav-link nav-menu-btn" id="nav-menu-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="nav-menu-list">Menu ▾</button>
        <div class="nav-menu-list" id="nav-menu-list" role="menu" hidden>
          ${ALL_PAGES.map(p=>`${p.sep ? '<div class="nav-menu-sep" role="separator"></div>' : ''}<a class="btn nav-link${p.id===page ? ' active' : ''}" role="menuitem" href="${p.href}"${p.id===page ? ' aria-current="page"' : ''}>${p.label}</a>`).join('')}
        </div>
      </div>
    </nav>
    <div class="site-actions">
      ${page==='atlas' ? '<button class="btn solid" id="open-upload" type="button">+ Nahrát trasu</button>' : ''}
      <button class="btn" id="open-about" type="button">O projektu</button>
      <button class="btn user-btn" id="user-chip" type="button" hidden></button>
      <a class="btn" id="login-link" href="index.html${page==='atlas' ? '' : '?next=' + encodeURIComponent(current.href)}" hidden>Přihlásit se</a>
    </div>`;

  // --- nabídka „Menu ▾“ ---
  if(!document.getElementById('nav-menu-style')){
    document.head.insertAdjacentHTML('beforeend', `<style id="nav-menu-style">
      .nav-menu{position:relative;display:inline-flex;}
      .nav-menu-list{position:absolute;top:calc(100% + 6px);left:0;z-index:2100;min-width:190px;display:flex;flex-direction:column;gap:6px;
        padding:8px;background:var(--bg-app,#172218);border:1px solid rgba(255,255,255,0.25);border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,0.35);}
      .nav-menu-list[hidden]{display:none;}
      .nav-menu-list .btn{justify-content:flex-start;}
      .nav-menu-sep{height:1px;background:rgba(255,255,255,0.2);margin:2px 0;}
    </style>`);
  }
  const menuBtn = document.getElementById('nav-menu-btn');
  const menuList = document.getElementById('nav-menu-list');
  function setMenu(open){
    menuList.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open){
      // na úzkém displeji ať nabídka nevyjede mimo obrazovku
      menuList.style.left = '0'; menuList.style.right = 'auto';
      const r = menuList.getBoundingClientRect();
      if(r.right > window.innerWidth - 8){ menuList.style.left = 'auto'; menuList.style.right = '0'; }
    }
  }
  menuBtn.addEventListener('click', e=>{ e.stopPropagation(); setMenu(menuList.hidden); });
  document.addEventListener('click', e=>{ if(!menuList.hidden && !menuList.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !menuList.hidden){ setMenu(false); menuBtn.focus(); } });

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
  if(!document.getElementById('account-overlay')){
    document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" id="account-overlay">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
    <button class="detail-close" id="account-close" type="button" aria-label="Zavřít">×</button>
    <h2 id="account-title">Můj účet</h2>
    <p class="sub" id="account-username-label"></p>
    <form id="change-password-form">
      <h3 class="account-sub">Změna hesla</h3>
      <label for="cp-current">Současné heslo</label>
      <input type="password" id="cp-current" autocomplete="current-password" required minlength="4">
      <label for="cp-new">Nové heslo</label>
      <input type="password" id="cp-new" autocomplete="new-password" required minlength="4">
      <label for="cp-confirm">Nové heslo znovu</label>
      <input type="password" id="cp-confirm" autocomplete="new-password" required minlength="4">
      <div class="form-msg" id="cp-msg"></div>
      <div class="actions">
        <button class="ghost-btn" id="cp-cancel" type="button">Zavřít</button>
        <button class="primary-btn" type="submit" style="margin-top:0;">Změnit heslo</button>
      </div>
    </form>
    <button class="logout-btn" id="logout-btn" type="button">Odhlásit se</button>
  </div>
</div>`);
  }

  const aboutOverlay = document.getElementById('about-overlay');
  const accountOverlay = document.getElementById('account-overlay');
  const userBtn = document.getElementById('user-chip');
  const loginLink = document.getElementById('login-link');
  const form = document.getElementById('change-password-form');
  let user = null;

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
    document.getElementById('account-username-label').textContent =
      'Přihlášen(a) jako ' + user.displayName + (user.role==='admin' ? ' (admin)' : '');
    form.reset();
    document.getElementById('cp-msg').textContent = '';
    accountOverlay.classList.add('open');
  });
  document.getElementById('account-close').addEventListener('click', ()=> accountOverlay.classList.remove('open'));
  document.getElementById('cp-cancel').addEventListener('click', ()=> accountOverlay.classList.remove('open'));
  closeOnBackdrop(accountOverlay);
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){ aboutOverlay.classList.remove('open'); accountOverlay.classList.remove('open'); }
  });

  form.addEventListener('submit', async e=>{
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
      await api('/api/auth/change-password', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ currentPassword: cur, newPassword: next }) });
      msg.style.color = 'var(--moss-dark)';
      msg.textContent = 'Heslo bylo změněno.';
      setTimeout(()=> accountOverlay.classList.remove('open'), 900);
    }catch(err){
      msg.textContent = err.message || 'Heslo se nepodařilo změnit.';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async ()=>{
    try{ await api('/api/auth/logout', { method:'POST' }); }catch(e){}
    try{ localStorage.removeItem('cenduroff.token'); }catch(e){}
    // po odhlášení vždy na přihlašovací stránku Atlasu
    location.href = 'index.html';
  });

  function setUser(u){
    user = u || null;
    userBtn.hidden = !user;
    loginLink.hidden = !!user;
    if(user) userBtn.textContent = user.displayName + (user.role==='admin' ? ' · admin' : '');
    window.dispatchEvent(new Event('resize')); // hlavička mohla změnit výšku (mobil)
  }

  window.CendurHeader = { setUser, page };

  if(header.dataset.auth === 'auto'){
    api('/api/auth/me').then(setUser).catch(()=> setUser(null));
  }
})();
