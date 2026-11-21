// ---------------------------------------------------------------
// CendurOFF – Komunita (komunita.html), v4.62: TOP uživatelé a TOP trasy
// Data: /api/community/users a /api/community/routes (veřejné)
// ---------------------------------------------------------------
(function(){
  const API = () => window.CENDUROFF_API_URL || 'https://api.cenduroff.cz';
  const R = window.CendurRider;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = n => (Number(n) || 0).toLocaleString('cs-CZ');
  let me = null, meId = null;

  async function api(path){
    const o = { credentials:'include' };
    try{ const t = localStorage.getItem('cenduroff.token'); if(t) o.headers = { Authorization:'Bearer ' + t }; }catch(e){}
    const res = await fetch(API() + path, o);
    let data = null; try{ data = await res.json(); }catch(e){}
    if(!res.ok){ const err = new Error((data && data.error) || 'Něco se pokazilo.'); err.status = res.status; throw err; }
    return data;
  }
  function fail(box, e){ box.innerHTML = '<p class="k-empty">' + esc(e.message) + '</p>'; }

  // ---------- TOP uživatelé ----------
  function renderUsers(list){
    const box = document.getElementById('k-users-box');
    const rows = list.map(u => {
      const st = u.stats || {};
      const rank = R ? R.badgeFor(st.km) : null;
      const ach = R ? R.achievements(st, u.earned).filter(a => a.got) : [];
      return { id:u.id, nick:u.nick, admin:u.role === 'admin', km:Number(st.km) || 0, ridden:st.ridden || 0, own:st.ownRoutes || 0, rank, ach };
    }).sort((a, b) => (b.km - a.km) || (b.ach.length - a.ach.length) || String(a.nick).localeCompare(String(b.nick), 'cs'));
    if(!rows.length){ box.innerHTML = '<p class="k-empty">Zatím tu nikdo není.</p>'; return; }
    rows.length = Math.min(rows.length, 10);
    box.innerHTML = '<table class="k-t"><thead><tr><th class="num">#</th><th>Nick</th><th class="num">Najeto</th><th class="num">Projeté trasy</th><th class="num">Přidané trasy</th><th>Hodnost</th><th>Odznaky</th></tr></thead><tbody>' +
      rows.map((u, i) => '<tr class="' + (i === 0 ? 'top1 ' : '') + (u.id === meId ? 'me' : '') + '"><td class="pos num">' + (i + 1) + '.</td><td class="nick">' + esc(u.nick) + (u.admin ? ' (admin)' : '') + '</td>' +
        '<td class="num big">' + (R ? R.fmtKm(u.km) : num(u.km) + ' km') + '</td><td class="num">' + num(u.ridden) + '</td><td class="num">' + num(u.own) + '</td>' +
        '<td>' + (u.rank ? u.rank.icon + ' ' + esc(u.rank.name) : '') + '</td>' +
        '<td class="k-ach">' + (u.ach.length ? u.ach.map(a => '<span title="' + esc(a.name) + '">' + a.icon + '</span>').join('') : '—') + '</td></tr>').join('') +
      '</tbody></table>';
  }

  // ---------- TOP trasy ----------
  const TYPE = { transport:'Transport', cenduro:'Cenduro', offroad:'Offroad' };
  function renderRoutes(list){
    const box = document.getElementById('k-routes-box');
    const rows = list.slice().sort((a, b) => ((b.rides || 0) - (a.rides || 0)) || ((b.stars || 0) - (a.stars || 0))).slice(0, 10);
    if(!rows.length){ box.innerHTML = '<p class="k-empty">Zatím tu nejsou žádné trasy.</p>'; return; }
    box.innerHTML = '<table class="k-t"><thead><tr><th class="num">#</th><th>Trasa</th><th>Autor</th><th>Typ</th><th class="num">Délka</th><th class="num">Projetí</th><th class="num">Jezdců</th><th class="num">Hodnocení</th></tr></thead><tbody>' +
      rows.map((r, i) => '<tr class="' + (i === 0 ? 'top1' : '') + '"><td class="pos num">' + (i + 1) + '.</td><td class="rname"><a href="index.html?atlas=1&trasa=' + encodeURIComponent(r.id) + '">' + esc(r.name) + '</a></td>' +
        '<td>' + esc(r.author) + '</td><td>' + esc(TYPE[r.route_type] || '') + '</td><td class="num">' + num(Math.round((r.distance_km || 0) * 10) / 10) + ' km</td>' +
        '<td class="num big">' + num(r.rides) + '</td><td class="num">' + num(r.riders) + '</td>' +
        '<td class="num">' + (r.votes ? '★ ' + String(r.stars).replace('.', ',') + ' <small>(' + r.votes + ')</small>' : '—') + '</td></tr>').join('') +
      '</tbody></table>';
  }

  async function load(){
    const ub = document.getElementById('k-users-box'), rb = document.getElementById('k-routes-box');
    try{ me = await api('/api/auth/me'); meId = me && me.id; }catch(e){ me = null; /* nepřihlášený – žebříčky vidí také */ }
    showTab();
    api('/api/community/users').then(renderUsers).catch(e => fail(ub, e));
    api('/api/community/routes').then(renderRoutes).catch(e => fail(rb, e));
  }

  // ---------- záložky (podružné menu) ----------
  const tabs = Array.from(document.querySelectorAll('.k-tab'));
  const panels = Array.from(document.querySelectorAll('.k-panel'));
  let curTab = null, loaded = false;
  function askLogin(){
    const go = () => { location.href = 'index.html?next=' + encodeURIComponent('komunita.html'); };
    if(window.CendurHeader && window.CendurHeader.ask) window.CendurHeader.ask({ title:'Chat je pro přihlášené', msg:'Do chatu se dostanou jen přihlášení členové.', yes:{ label:'Přihlásit se', fn:go } });
    else go();
  }
  function showTab(){
    let id = (location.hash || '').slice(1);
    if(!tabs.some(t => t.dataset.tab === id)) id = tabs[0].dataset.tab;
    // chat je jen pro přihlášené – nepřihlášený ho neotevře (server ho stejně nepustí)
    if(id === 'chat' && loaded && !me){ askLogin(); id = curTab && curTab !== 'chat' ? curTab : tabs[0].dataset.tab; try{ history.replaceState(null, '', '#' + id); }catch(e){} }
    if(id === 'chat' && !loaded) id = tabs[0].dataset.tab;   // než se ví, kdo je přihlášený
    curTab = id;
    tabs.forEach(t => { const on = t.dataset.tab === id; t.classList.toggle('active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); if(on) t.scrollIntoView({ block:'nearest', inline:'center' }); });
    panels.forEach(p => { p.hidden = p.id !== id; });
    chatActive(id === 'chat' && !!me);
    if(loaded && (id === 'aktuality' || id === 'fotoreporty')) openPosts(id);
  }
  window.addEventListener('hashchange', showTab);

  // ---------- chat ----------
  const msgsEl = document.getElementById('k-msgs'), textEl = document.getElementById('k-text'), errEl = document.getElementById('k-err');
  let lastId = 0, timer = 0, chatLoaded = false, sending = false;
  const pad = n => String(n).padStart(2, '0');
  function fmtTime(iso){
    const d = new Date(iso), now = new Date();
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    return d.toDateString() === now.toDateString() ? hm : d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + hm;
  }
  function msgEl(m){
    const row = document.createElement('div');
    row.className = 'k-msg' + (m.user_id === meId ? ' mine' : ''); row.dataset.id = m.id;
    const head = document.createElement('div'); head.className = 'k-mh';
    const nick = document.createElement('b'); nick.textContent = (m.nick || 'smazaný účet') + (m.role === 'admin' ? ' (admin)' : '');
    const time = document.createElement('span'); time.textContent = fmtTime(m.created_at);
    head.appendChild(nick); head.appendChild(time);
    if(m.user_id === meId || (me && me.role === 'admin')){
      const del = document.createElement('button'); del.type = 'button'; del.className = 'k-del'; del.textContent = 'Smazat'; del.dataset.del = m.id; head.appendChild(del);
    }
    const body = document.createElement('div'); body.className = 'k-mt'; body.textContent = m.text;
    row.appendChild(head); row.appendChild(body);
    return row;
  }
  function addMessages(list, first){
    if(first) msgsEl.innerHTML = '';
    if(!list.length){ if(first) msgsEl.innerHTML = '<p class="k-empty">Zatím tu nikdo nenapsal. Začni první.</p>'; return; }
    const near = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 80;
    const empty = msgsEl.querySelector('.k-empty'); if(empty) empty.remove();
    list.forEach(m => { if(!msgsEl.querySelector('[data-id="' + m.id + '"]')){ msgsEl.appendChild(msgEl(m)); } if(m.id > lastId) lastId = m.id; });
    if(first || near) msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  async function poll(){
    if(document.hidden || !me) return;
    try{
      const list = await api('/api/chat' + (lastId ? '?after=' + lastId : ''));
      addMessages(list, !chatLoaded); chatLoaded = true; errEl.textContent = '';
    }catch(e){ if(!chatLoaded) msgsEl.innerHTML = '<p class="k-empty">' + esc(e.message) + '</p>'; }
  }
  // zprávy se načtou při otevření a pak každých 20 s, jen když je chat vidět (šetří data i baterii)
  function chatActive(on){
    clearInterval(timer); timer = 0;
    if(!on) return;
    poll();
    timer = setInterval(poll, 20000);
  }
  document.addEventListener('visibilitychange', () => { if(!document.hidden && timer) poll(); });
  document.getElementById('k-send').addEventListener('submit', async e => {
    e.preventDefault();
    const text = textEl.value.trim();
    if(!text || sending) return;
    sending = true; errEl.textContent = '';
    try{
      const o = { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ text }) };
      try{ const t = localStorage.getItem('cenduroff.token'); if(t) o.headers.Authorization = 'Bearer ' + t; }catch(e2){}
      const res = await fetch(API() + '/api/chat', o);
      const data = await res.json().catch(() => null);
      if(!res.ok) throw new Error((data && data.error) || 'Zprávu se nepodařilo odeslat.');
      textEl.value = ''; textEl.style.height = '';
      addMessages([data], false); msgsEl.scrollTop = msgsEl.scrollHeight;
    }catch(err){ errEl.textContent = err.message; }
    finally{ sending = false; textEl.focus(); }
  });
  textEl.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); document.getElementById('k-send').requestSubmit(); } });
  textEl.addEventListener('input', () => { textEl.style.height = 'auto'; textEl.style.height = Math.min(textEl.scrollHeight, 140) + 'px'; });
  msgsEl.addEventListener('click', async e => {
    const b = e.target.closest('[data-del]'); if(!b) return;
    try{
      const o = { method:'DELETE', credentials:'include', headers:{} };
      try{ const t = localStorage.getItem('cenduroff.token'); if(t) o.headers.Authorization = 'Bearer ' + t; }catch(e2){}
      const res = await fetch(API() + '/api/chat/' + encodeURIComponent(b.dataset.del), o);
      if(!res.ok){ const d = await res.json().catch(() => null); throw new Error((d && d.error) || 'Smazání se nepovedlo.'); }
      const row = msgsEl.querySelector('[data-id="' + b.dataset.del + '"]'); if(row) row.remove();
    }catch(err){ errEl.textContent = err.message; }
  });


  // ---------- články: Aktuality a Fotoreportáže (v4.64) ----------
  const MAXP = { aktuality:4, fotoreporty:12 };
  const posts = {};   // kind -> { loaded, oldest, more, perm, files:[dataURL], editId }
  const MONTHS = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
  function fmtDate(iso){ const d = new Date(iso); return d.getDate() + '. ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  async function send(method, path, body){
    const o = { method, credentials:'include', headers:{ 'Content-Type':'application/json' } };
    try{ const t = localStorage.getItem('cenduroff.token'); if(t) o.headers.Authorization = 'Bearer ' + t; }catch(e){}
    if(body) o.body = JSON.stringify(body);
    const res = await fetch(API() + path, o);
    const data = await res.json().catch(() => null);
    if(!res.ok) throw new Error((data && data.error) || 'Něco se pokazilo.');
    return data;
  }
  function postEl(kind, p){
    const art = document.createElement('article'); art.className = 'k-post'; art.dataset.id = p.id;
    const h = document.createElement('h3'); h.textContent = p.title; art.appendChild(h);
    const meta = document.createElement('div'); meta.className = 'k-pmeta';
    meta.textContent = (p.nick || 'smazaný účet') + (p.role === 'admin' ? ' (admin)' : '') + ' · ' + fmtDate(p.created_at) + (p.updated_at ? ' · upraveno' : '');
    if(me && (me.role === 'admin' || p.user_id === meId)){
      const ed = document.createElement('button'); ed.type = 'button'; ed.className = 'k-del k-edit'; ed.textContent = 'Upravit'; ed.dataset.edit = p.id;
      const del = document.createElement('button'); del.type = 'button'; del.className = 'k-del'; del.textContent = 'Smazat'; del.dataset.delpost = p.id;
      meta.appendChild(ed); meta.appendChild(del);
    }
    art.appendChild(meta);
    const t = document.createElement('div'); t.className = 'k-ptext'; t.textContent = p.text; art.appendChild(t);
    if(p.photos && p.photos.length){
      const g = document.createElement('div'); g.className = 'k-pgal' + (p.photos.length === 1 ? ' one' : '');
      p.photos.forEach(id => {
        const a = document.createElement('a'); a.href = API() + '/api/posts/photo/' + id; a.className = 'k-ph'; a.dataset.photo = '1';
        const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.alt = p.title; im.src = a.href;
        a.appendChild(im); g.appendChild(a);
      });
      art.appendChild(g);
    }
    return art;
  }
  async function loadPosts(kind, more){
    const st = posts[kind], box = document.getElementById('k-posts-' + kind), btn = document.getElementById('k-more-' + kind);
    try{
      const d = await api('/api/posts?kind=' + kind + (more && st.oldest ? '&before=' + st.oldest : ''));
      if(!more) box.innerHTML = '';
      d.posts.forEach(p => { box.appendChild(postEl(kind, p)); st.oldest = p.id; });
      if(!box.children.length) box.innerHTML = '<p class="k-empty">Zatím tu nic není.</p>';
      btn.hidden = !d.more;
    }catch(e){ if(!more) fail(box, e); }
  }
  async function openPosts(kind){
    if(!posts[kind]) posts[kind] = { files:[], oldest:0, editId:0 };
    const st = posts[kind];
    if(!st.loaded){
      st.loaded = true;
      loadPosts(kind, false);
      if(me){ try{ const perm = await api('/api/posts/perm'); st.perm = !!perm[kind]; }catch(e){ st.perm = false; } }
      document.getElementById('k-bar-' + kind).hidden = !st.perm;
    }
  }
  // zmenšení fotky v prohlížeči (max 1600 px, JPEG) – šetří data i místo na serveru
  async function shrink(file){
    const bmp = await createImageBitmap(file).catch(() => null);
    if(!bmp) throw new Error('Soubor ' + file.name + ' nejde otevřít jako obrázek.');
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if(bmp.close) bmp.close();
    let q = 0.82, url = c.toDataURL('image/jpeg', q);
    while(url.length > 1900000 && q > 0.4){ q -= 0.1; url = c.toDataURL('image/jpeg', q); }
    return url;
  }
  function drawThumbs(kind){
    const f = document.getElementById('k-form-' + kind), st = posts[kind];
    const th = f.querySelector('.k-thumbs'); th.innerHTML = '';
    st.files.forEach((u, i) => {
      const w = document.createElement('div'); w.className = 'k-th';
      const im = document.createElement('img'); im.src = u; im.alt = '';
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.dataset.rm = i; x.setAttribute('aria-label', 'Odebrat fotku');
      w.appendChild(im); w.appendChild(x); th.appendChild(w);
    });
    f.querySelector('.k-fhint').textContent = st.files.length ? st.files.length + ' / ' + MAXP[kind] : 'Nejvýš ' + MAXP[kind] + ' fotek';
  }
  function closeForm(kind){
    const f = document.getElementById('k-form-' + kind), st = posts[kind];
    f.hidden = true; f.reset(); st.files = []; st.editId = 0; f.querySelector('.k-err').textContent = '';
    f.querySelector('.k-files').hidden = false; f.querySelector('button[type=submit]').textContent = 'Publikovat';
    drawThumbs(kind);
  }
  ['aktuality', 'fotoreporty'].forEach(kind => {
    const f = document.getElementById('k-form-' + kind), box = document.getElementById('k-posts-' + kind);
    document.getElementById('k-more-' + kind).addEventListener('click', () => loadPosts(kind, true));
    document.querySelector('[data-new="' + kind + '"]').addEventListener('click', () => { closeForm(kind); f.hidden = false; drawThumbs(kind); f.title.focus(); });
    f.querySelector('[data-cancel]').addEventListener('click', () => closeForm(kind));
    f.photos.addEventListener('change', async () => {
      const st = posts[kind], err = f.querySelector('.k-err'); err.textContent = '';
      const list = Array.from(f.photos.files); f.photos.value = '';
      for(const file of list){
        if(st.files.length >= MAXP[kind]){ err.textContent = 'Nejvýš ' + MAXP[kind] + ' fotek.'; break; }
        try{ st.files.push(await shrink(file)); }catch(e){ err.textContent = e.message; }
      }
      drawThumbs(kind);
    });
    f.querySelector('.k-thumbs').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if(!b) return; posts[kind].files.splice(Number(b.dataset.rm), 1); drawThumbs(kind); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const st = posts[kind], err = f.querySelector('.k-err'), btn = f.querySelector('button[type=submit]');
      err.textContent = ''; btn.disabled = true;
      try{
        if(st.editId) await send('PUT', '/api/posts/' + st.editId, { title:f.title.value, text:f.text.value });
        else await send('POST', '/api/posts', { kind, title:f.title.value, text:f.text.value, photos:st.files });
        closeForm(kind); st.oldest = 0; await loadPosts(kind, false);
      }catch(e2){ err.textContent = e2.message; }
      finally{ btn.disabled = false; }
    });
    box.addEventListener('click', async e => {
      const st = posts[kind];
      const ph = e.target.closest('[data-photo]');
      if(ph){ e.preventDefault(); lightbox(ph.href); return; }
      const ed = e.target.closest('[data-edit]');
      if(ed){
        const art = ed.closest('.k-post'); closeForm(kind);
        f.title.value = art.querySelector('h3').textContent; f.text.value = art.querySelector('.k-ptext').textContent;
        st.editId = Number(ed.dataset.edit); f.querySelector('.k-files').hidden = true; f.querySelector('button[type=submit]').textContent = 'Uložit změny';
        f.hidden = false; f.scrollIntoView({ block:'nearest' }); f.title.focus(); return;
      }
      const dl = e.target.closest('[data-delpost]');
      if(dl){
        const go = async () => { try{ await send('DELETE', '/api/posts/' + dl.dataset.delpost); const a = dl.closest('.k-post'); if(a) a.remove(); if(!box.children.length) box.innerHTML = '<p class="k-empty">Zatím tu nic není.</p>'; }catch(e2){ alert(e2.message); } };
        if(window.CendurHeader && window.CendurHeader.ask) window.CendurHeader.ask({ title:'Smazat článek?', msg:'Článek i s fotkami zmizí.', yes:{ label:'Smazat', fn:go } });
        else if(confirm('Smazat článek?')) go();
      }
    });
  });
  function lightbox(src){
    const o = document.createElement('div'); o.className = 'k-lb'; o.innerHTML = '<img alt="">'; o.firstChild.src = src;
    const close = () => { o.remove(); document.removeEventListener('keydown', key); };
    const key = ev => { if(ev.key === 'Escape') close(); };
    o.addEventListener('click', close); document.addEventListener('keydown', key); document.body.appendChild(o);
  }

  showTab();
  load().then(() => { loaded = true; showTab(); });
})();
