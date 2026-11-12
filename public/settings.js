// ---------------------------------------------------------------
// CendurOFF – Nastavení účtu (nastaveni.html), v3.2
// ---------------------------------------------------------------
(function(){
  const API_URL = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
  const $ = id => document.getElementById(id);

  function toast(msg, ms){
    const t = $('toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._h); toast._h = setTimeout(() => { t.style.display = 'none'; }, ms || 3000);
  }
  async function api(url, options){
    const o = Object.assign({ credentials:'include' }, options);
    let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
    if(t) o.headers = Object.assign({}, o.headers, { Authorization:'Bearer ' + t });
    const res = await fetch(API_URL + url, o);
    let data = null; try{ data = await res.json(); }catch(e){}
    if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
    return data;
  }

  // ---------- účet ----------
  async function boot(){
    let user = null;
    try{ user = await api('/api/auth/me'); }catch(e){}
    if(!user){ location.replace('index.html?next=' + encodeURIComponent('nastaveni.html')); return; }
    document.body.classList.remove('auth-pending');
    if(window.CendurHeader) window.CendurHeader.setUser(user);
    $('s-name').textContent = user.displayName;
    $('s-role').textContent = (user.role === 'admin' ? 'administrátor' : 'uživatel') + (user.username && user.username.toLowerCase() !== String(user.displayName).toLowerCase() ? ' · přihlašovací jméno ' + user.username : '');
    $('s-admin-row').hidden = user.role !== 'admin';
    loadProfile();
  }

  // ---------- plánovač: podklad pro hledání cesty (v4.7) ----------
  const PL_KEY = 'cenduroff.planner.settings';
  function plGet(){ try{ return JSON.parse(localStorage.getItem(PL_KEY) || '{}') || {}; }catch(e){ return {}; } }
  function showEngine(){
    const eng = plGet().engine === 'osm' ? 'osm' : 'mapy';
    document.querySelectorAll('[data-engine]').forEach(b => { const on = b.dataset.engine === eng; b.classList.toggle('primary', on); b.setAttribute('aria-pressed', on); });
    $('s-eng-note').textContent = eng === 'mapy' ? 'Mapy.com – drží se turistických stezek' : 'OpenStreetMap (BRouter) – víc lesních a polních cest';
  }
  document.querySelectorAll('[data-engine]').forEach(b => b.addEventListener('click', () => {
    const st = plGet(); st.engine = b.dataset.engine;
    try{ localStorage.setItem(PL_KEY, JSON.stringify(st)); }catch(e){}
    showEngine(); toast('Plánovač bude hledat cestu podle ' + (st.engine === 'mapy' ? 'Mapy.com' : 'OpenStreetMap') + '.');
  }));
  showEngine();

  // ---------- profil jezdce (v4.3) ----------
  const R = window.CendurRider;
  function showProfile(p){
    if(!R) return;
    const b = R.badgeFor(p.km);
    $('s-badge-icon').textContent = b.icon;
    $('s-badge-name').textContent = b.name + ' · hodnost ' + b.level + '/' + R.BADGES.length;
    $('s-km').textContent = 'najeto ' + R.fmtKm(p.km);
    $('s-prog-bar').style.width = b.pct + '%';
    $('s-next').textContent = b.next ? 'do hodnosti ' + b.next.icon + ' ' + b.next.name + ' zbývá ' + R.fmtKm(b.toNext) : 'nejvyšší hodnost – klobouk dolů!';
    $('s-badge-list').innerHTML = R.BADGES.map((x, i) => '<li class="' + (p.km >= x.km ? 'got' : '') + '"><span>' + x.icon + '</span> <b>' + x.name + '</b> <small>od ' + R.fmtKm(x.km) + '</small></li>').join('');
  }
  // v4.4: sběratelské odznaky – získané nahoře, u ostatních postup
  function showAchievements(p){
    if(!R || !R.achievements) return;
    const list = R.achievements(p.stats, p.earned).sort((a, b) => (b.got - a.got) || (b.pct - a.pct));
    const got = list.filter(a => a.got).length;
    $('s-ach-count').textContent = got + ' z ' + list.length;
    $('s-ach').innerHTML = list.map(a => '<div class="s-ach-i' + (a.got ? ' got' : '') + '">' +
      '<span class="s-ach-ic">' + a.icon + '</span><div class="s-ach-t"><b>' + a.name + (a.got ? ' ✓' : '') + '</b><small>' + a.desc + '</small>' +
      (a.got ? '' : '<div class="s-ach-p">' + a.parts.map(x => x.cur + '/' + x.need + ' ' + x.label).join(' · ') + '</div>' +
        '<div class="s-prog"><i style="width:' + a.pct + '%"></i></div>') +
      '</div></div>').join('');
  }
  async function loadProfile(){
    try{
      const p = await api('/api/profile');
      $('s-bike').value = p.bike || '';
      showProfile(p); showAchievements(p);
      if(location.hash === '#odznaky') setTimeout(() => { const el = $('s-ach-card'); if(el) el.scrollIntoView({ block:'start' }); }, 50);
    }catch(e){ $('s-km').textContent = 'profil se nepodařilo načíst'; }
  }
  $('s-bike-form').addEventListener('submit', async e => {
    e.preventDefault();
    try{
      const r = await api('/api/profile', { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ bike: $('s-bike').value }) });
      $('s-bike').value = r.bike || '';
      toast(r.bike ? 'Motorka uložena: ' + r.bike : 'Motorka smazána.');
    }catch(err){ toast(err.message || 'Uložení se nepovedlo.'); }
  });
  $('s-logout').addEventListener('click', async () => {
    try{ await api('/api/auth/logout', { method:'POST' }); }catch(e){}
    try{ localStorage.removeItem('cenduroff.token'); }catch(e){}
    location.href = 'index.html';
  });

  // ---------- zvuky ----------
  const S = window.CendurSound;
  function renderSnd(){
    const on = S ? S.enabled() : true;
    $('s-snd').setAttribute('aria-checked', on ? 'true' : 'false');
    $('s-snd-note').textContent = !on ? 'vypnuto – navigace je potichu'
      : (S && !S.hasVoice() ? 'gong a bzučák (tenhle telefon nemá český hlas)' : 'gong před instrukcí, bzučák u nebezpečí, hlas telefonu');
  }
  $('s-snd').addEventListener('click', () => {
    if(!S) return;
    const on = !S.enabled();
    S.setEnabled(on);
    renderSnd();
    if(on) S.announce('gong', 'Zvuky jsou zapnuté.');
  });
  const TEST_TEXT = { gong: 'Za devadesát metrů ostře vpravo.', buzzer: 'Za sto metrů vlevo, nebezpečí.', gentle: 'Jsi mimo trasu.' };
  document.querySelectorAll('[data-test]').forEach(b => b.addEventListener('click', () => {
    if(!S) return;
    if(!S.enabled()){ toast('Zvuky jsou vypnuté – zapni je přepínačem nahoře.'); return; }
    S.announce(b.dataset.test, TEST_TEXT[b.dataset.test]);
  }));
  // české hlasy se v prohlížeči načítají se zpožděním
  if('speechSynthesis' in window){ try{ speechSynthesis.onvoiceschanged = renderSnd; }catch(e){} }
  renderSnd();
  setTimeout(renderSnd, 1500);

  // ---------- heslo ----------
  const form = $('s-pw');
  function setPw(open){
    form.hidden = !open;
    $('s-pw-open').hidden = open;
    $('s-pw-open').setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open){ form.reset(); $('cp-msg').textContent = ''; $('cp-msg').className = 's-msg'; $('cp-current').focus(); }
  }
  $('s-pw-open').addEventListener('click', () => setPw(true));
  $('s-pw-cancel').addEventListener('click', () => setPw(false));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('cp-msg');
    const cur = $('cp-current').value, next = $('cp-new').value, conf = $('cp-confirm').value;
    msg.className = 's-msg';
    if(next.length < 4){ msg.textContent = 'Nové heslo musí mít alespoň 4 znaky.'; return; }
    if(next !== conf){ msg.textContent = 'Nová hesla se neshodují.'; return; }
    msg.textContent = 'Ukládám…';
    try{
      await api('/api/auth/change-password', { method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }) });
      msg.className = 's-msg ok'; msg.textContent = 'Heslo bylo změněno.';
      setTimeout(() => setPw(false), 1200);
    }catch(err){ msg.textContent = err.message || 'Heslo se nepodařilo změnit.'; }
  });

  // ---------- aplikace ----------
  let ver = 'web ' + (window.CENDUROFF_WEB_VERSION || '3.2');
  try{ if(window.CendurApp && window.CendurApp.version) ver += ' · aplikace pro Android ' + window.CendurApp.version(); }catch(e){}
  $('s-ver').textContent = ver;

  boot();
})();
