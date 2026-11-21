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
  const roleTag = r => ({ admin:' (admin)', moderator:' (moderátor)', reporter:' (reporter)' }[r] || '');
  const isMod = () => !!(me && (me.role === 'admin' || me.role === 'moderator'));

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
      return { id:u.id, nick:u.nick, tag:roleTag(u.role), km:Number(st.km) || 0, ridden:st.ridden || 0, own:st.ownRoutes || 0, rank, ach };
    }).sort((a, b) => (b.km - a.km) || (b.ach.length - a.ach.length) || String(a.nick).localeCompare(String(b.nick), 'cs'));
    if(!rows.length){ box.innerHTML = '<p class="k-empty">Zatím tu nikdo není.</p>'; return; }
    rows.length = Math.min(rows.length, 10);
    box.innerHTML = '<table class="k-t"><thead><tr><th class="num">#</th><th>Nick</th><th class="num">Najeto</th><th>Hodnost</th><th>Odznaky</th><th class="num">Projeté trasy</th><th class="num">Přidané trasy</th></tr></thead><tbody>' +
      rows.map((u, i) => '<tr class="' + (i === 0 ? 'top1 ' : '') + (u.id === meId ? 'me' : '') + '"><td class="pos num">' + (i + 1) + '.</td><td class="nick">' + esc(u.nick) + esc(u.tag) + '</td>' +
        '<td class="num big">' + (R ? R.fmtKm(u.km) : num(u.km) + ' km') + '</td>' +
        '<td>' + (u.rank ? u.rank.icon + ' ' + esc(u.rank.name) : '') + '</td>' +
        '<td class="k-ach">' + (u.ach.length ? u.ach.map(a => '<span title="' + esc(a.name) + '">' + a.icon + '</span>').join('') : '—') + '</td>' +
        '<td class="num">' + num(u.ridden) + '</td><td class="num">' + num(u.own) + '</td></tr>').join('') +
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
    if(loaded && id === 'srazy') openEvents();
    if(loaded && id === 'mista') openPlaces();
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
    const nick = document.createElement('b'); nick.textContent = (m.nick || 'smazaný účet') + roleTag(m.role);
    const time = document.createElement('span'); time.textContent = fmtTime(m.created_at);
    head.appendChild(nick); head.appendChild(time);
    if(m.user_id === meId || isMod()){
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


  // ---------- články: Aktuality a Články (v4.64) ----------
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
    meta.textContent = (p.nick || 'smazaný účet') + roleTag(p.role) + ' · ' + fmtDate(p.created_at) + (p.updated_at ? ' · upraveno' : '');
    if(me && (isMod() || p.user_id === meId)){
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
    const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'k-cbtn'; cb.dataset.comments = p.id;
    cb.textContent = 'Komentáře (' + (p.comments || 0) + ')';
    art.appendChild(cb);
    const cs = document.createElement('div'); cs.className = 'k-comments'; cs.hidden = true; art.appendChild(cs);
    return art;
  }
  // komentáře se načtou až po rozkliknutí (šetří data)
  function commentEl(c){
    const row = document.createElement('div'); row.className = 'k-cm'; row.dataset.cid = c.id;
    const head = document.createElement('div'); head.className = 'k-mh';
    const nick = document.createElement('b'); nick.textContent = (c.nick || 'smazaný účet') + roleTag(c.role);
    const time = document.createElement('span'); time.textContent = fmtTime(c.created_at);
    head.appendChild(nick); head.appendChild(time);
    if(c.user_id === meId || isMod()){ const del = document.createElement('button'); del.type = 'button'; del.className = 'k-del'; del.textContent = 'Smazat'; del.dataset.delcm = c.id; head.appendChild(del); }
    const t = document.createElement('div'); t.className = 'k-mt'; t.textContent = c.text;
    row.appendChild(head); row.appendChild(t);
    return row;
  }
  function setCount(art, n){ const b = art.querySelector('.k-cbtn'); if(b) b.textContent = 'Komentáře (' + n + ')'; }
  async function toggleComments(art, path){
    const box = art.querySelector('.k-comments');
    if(!box.hidden){ box.hidden = true; return; }
    box.hidden = false;
    if(box.dataset.loaded) return;
    box.innerHTML = '<p class="k-empty">Načítám…</p>';
    try{
      const list = await api(path || ('/api/posts/' + art.dataset.id + '/comments'));
      box.innerHTML = '';
      const lst = document.createElement('div'); lst.className = 'k-clist';
      list.forEach(c => lst.appendChild(commentEl(c)));
      if(!list.length) lst.innerHTML = '<p class="k-empty">Zatím bez komentářů.</p>';
      box.appendChild(lst);
      if(me){
        const f = document.createElement('form'); f.className = 'k-cform';
        f.innerHTML = '<textarea class="k-in" rows="2" maxlength="1000" placeholder="Napiš komentář…" aria-label="Komentář" required></textarea><button class="k-btn" type="submit">Odeslat</button><div class="k-err" role="alert"></div>';
        box.appendChild(f);
      }else{
        const a = document.createElement('p'); a.className = 'k-note'; a.innerHTML = '<a href="index.html?next=komunita.html">Přihlas se</a>, pokud chceš komentovat.'; box.appendChild(a);
      }
      box.dataset.loaded = '1';
    }catch(e){ box.innerHTML = '<p class="k-empty">' + esc(e.message) + '</p>'; }
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
    box.addEventListener('submit', async e => {
      const f = e.target.closest('.k-cform'); if(!f) return;
      e.preventDefault();
      const art = f.closest('.k-post'), ta = f.querySelector('textarea'), err = f.querySelector('.k-err'), btn = f.querySelector('button');
      if(!ta.value.trim()) return;
      err.textContent = ''; btn.disabled = true;
      try{
        const c = await send('POST', '/api/posts/' + art.dataset.id + '/comments', { text:ta.value });
        const lst = art.querySelector('.k-clist'); const em = lst.querySelector('.k-empty'); if(em) em.remove();
        lst.appendChild(commentEl(c)); ta.value = ''; setCount(art, lst.querySelectorAll('.k-cm').length);
      }catch(e2){ err.textContent = e2.message; }
      finally{ btn.disabled = false; }
    });
    box.addEventListener('click', async e => {
      const st = posts[kind];
      const cb = e.target.closest('[data-comments]');
      if(cb){ toggleComments(cb.closest('.k-post')); return; }
      const dc = e.target.closest('[data-delcm]');
      if(dc){
        try{
          await send('DELETE', '/api/posts/comments/' + dc.dataset.delcm);
          const art = dc.closest('.k-post'); dc.closest('.k-cm').remove();
          const n = art.querySelectorAll('.k-cm').length; setCount(art, n);
          if(!n) art.querySelector('.k-clist').innerHTML = '<p class="k-empty">Zatím bez komentářů.</p>';
        }catch(e2){ alert(e2.message); }
        return;
      }
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


  // ---------- Akce (v4.69) ----------
  const ev = { loaded:false, editId:0, photo:null, pastOff:0 };
  const dayOf = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return new Date(+m[1], +m[2] - 1, +m[3]); };
  const whenFmt = e => {
    const a = dayOf(e.date_from), b = dayOf(e.date_to || e.date_from);
    if(a.getTime() === b.getTime()) return a.toLocaleDateString('cs-CZ', { weekday:'short', day:'numeric', month:'numeric', year:'numeric' });
    const d = x => x.getDate() + '. ' + (x.getMonth() + 1) + '.';
    return a.getFullYear() === b.getFullYear() ? d(a) + ' – ' + d(b) + ' ' + b.getFullYear() : d(a) + ' ' + a.getFullYear() + ' – ' + d(b) + ' ' + b.getFullYear();
  };
  const eEl = id => document.getElementById(id);
  const goingTxt = n => n === 0 ? 'Zatím nikdo' : n + (n === 1 ? ' účastník' : n < 5 ? ' účastníci' : ' účastníků');
  function mapLink(place){ return 'https://mapy.com/cs/zakladni?q=' + encodeURIComponent(place); }
  function eventEl(e, past){
    const art = document.createElement('article'); art.className = 'k-post k-event'; art.dataset.eid = e.id; art.id = 'sraz-' + e.id;
    art.dataset.ev = JSON.stringify({ title:e.title, date_from:e.date_from, date_to:e.date_to, place:e.place, description:e.description, url:e.url });
    const h = document.createElement('h3'); h.textContent = e.title; art.appendChild(h);
    const when = document.createElement('div'); when.className = 'k-ewhen'; when.textContent = whenFmt(e); art.appendChild(when);
    const pl = document.createElement('div'); pl.className = 'k-eplace';
    pl.appendChild(document.createTextNode(e.place + ' · '));
    const ml = document.createElement('a'); ml.href = mapLink(e.place); ml.target = '_blank'; ml.rel = 'noopener'; ml.textContent = 'na mapě'; pl.appendChild(ml);
    art.appendChild(pl);
    const meta = document.createElement('div'); meta.className = 'k-pmeta';
    meta.textContent = 'Přidal ' + (e.nick || 'smazaný účet') + roleTag(e.role);
    if(me && (isMod() || e.user_id === meId)){
      const ed = document.createElement('button'); ed.type = 'button'; ed.className = 'k-del k-edit'; ed.textContent = 'Upravit'; ed.dataset.eedit = e.id;
      const del = document.createElement('button'); del.type = 'button'; del.className = 'k-del'; del.textContent = 'Smazat'; del.dataset.edel = e.id;
      meta.appendChild(ed); meta.appendChild(del);
    }
    art.appendChild(meta);
    if(e.description){ const t = document.createElement('div'); t.className = 'k-ptext'; t.textContent = e.description; art.appendChild(t); }
    if(e.url){ const p = document.createElement('p'); p.className = 'k-elink'; const a = document.createElement('a'); a.href = e.url; a.target = '_blank'; a.rel = 'noopener nofollow'; a.textContent = e.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60); p.appendChild(a); art.appendChild(p); }
    if(e.has_photo){
      const g = document.createElement('div'); g.className = 'k-pgal one';
      const a = document.createElement('a'); a.href = API() + '/api/events/photo/' + e.id; a.className = 'k-ph'; a.dataset.photo = '1';
      const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.alt = e.title; im.src = a.href; a.appendChild(im); g.appendChild(a); art.appendChild(g);
    }
    const bar = document.createElement('div'); bar.className = 'k-ebar2';
    if(!past){
      const j = document.createElement('button'); j.type = 'button'; j.className = 'k-btn k-join' + (e.joined ? ' on' : ''); j.dataset.join = e.id; j.textContent = e.joined ? 'Zúčastním se ✓' : 'Zúčastním se'; bar.appendChild(j);
    }
    const gl = document.createElement('button'); gl.type = 'button'; gl.className = 'k-cbtn k-going'; gl.dataset.going = e.id; gl.dataset.n = e.going; gl.textContent = (past ? 'Zúčastnili se: ' : 'Jedou: ') + goingTxt(e.going).toLowerCase().replace('zatím nikdo', 'zatím nikdo');
    bar.appendChild(gl); art.appendChild(bar);
    const gb = document.createElement('div'); gb.className = 'k-comments k-glist'; gb.hidden = true; art.appendChild(gb);
    return art;
  }
  function renderNext(list){
    const box = eEl('k-next');
    if(!list.length){ box.innerHTML = '<p class="k-empty">Zatím není naplánovaná žádná akce.</p>'; return; }
    box.innerHTML = '<table class="k-t k-tn"><tbody>' + list.slice(0, 5).map(e =>
      '<tr><td class="k-nd">' + esc(whenFmt(e)) + '</td><td class="nick"><a href="#srazy" data-jump="' + e.id + '">' + esc(e.title) + '</a></td><td>' + esc(e.place) + '</td><td class="num">' + esc(goingTxt(e.going)) + '</td></tr>').join('') + '</tbody></table>';
  }
  async function loadEvents(){
    const box = eEl('k-events');
    try{
      const d = await api('/api/events');
      renderNext(d.events);
      box.innerHTML = '';
      d.events.forEach(e => box.appendChild(eventEl(e, false)));
      if(!d.events.length) box.innerHTML = '<p class="k-empty">Zatím tu nic není. Přidej první akci.</p>';
    }catch(e){ fail(box, e); eEl('k-next').innerHTML = ''; }
  }
  async function loadPast(more){
    const box = eEl('k-events-past'), btn = eEl('k-epast-more');
    if(!more){ ev.pastOff = 0; box.innerHTML = ''; }
    try{
      const d = await api('/api/events?past=1&offset=' + ev.pastOff);
      d.events.forEach(e => box.appendChild(eventEl(e, true)));
      ev.pastOff += d.events.length;
      if(!box.children.length) box.innerHTML = '<p class="k-empty">Žádné proběhlé akce.</p>';
      btn.hidden = !d.more;
    }catch(e){ fail(box, e); }
  }
  function openEvents(){
    if(ev.loaded) return;
    ev.loaded = true;
    eEl('k-ebar').hidden = !me;
    loadEvents();
  }
  function eClose(){
    const f = eEl('k-eform'); f.hidden = true; f.reset(); ev.photo = null; ev.editId = 0;
    f.querySelector('.k-err').textContent = ''; f.querySelector('.k-thumbs').innerHTML = '';
    f.querySelector('.k-files').hidden = false; f.querySelector('button[type=submit]').textContent = 'Přidat akci';
  }
  (function(){
    const f = eEl('k-eform');
    eEl('k-enew').addEventListener('click', () => { eClose(); f.hidden = false; f.title.focus(); });
    eEl('k-ecancel').addEventListener('click', eClose);
    eEl('k-epast').addEventListener('click', () => { eEl('k-epast').hidden = true; loadPast(false); });
    eEl('k-epast-more').addEventListener('click', () => loadPast(true));
    f.photo.addEventListener('change', async () => {
      const err = f.querySelector('.k-err'); err.textContent = '';
      const file = f.photo.files[0]; f.photo.value = ''; if(!file) return;
      try{
        ev.photo = await shrink(file);
        const th = f.querySelector('.k-thumbs'); th.innerHTML = '';
        const w = document.createElement('div'); w.className = 'k-th';
        const im = document.createElement('img'); im.src = ev.photo; im.alt = '';
        const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Odebrat fotku');
        x.addEventListener('click', () => { ev.photo = null; th.innerHTML = ''; });
        w.appendChild(im); w.appendChild(x); th.appendChild(w);
      }catch(e){ err.textContent = e.message; }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const err = f.querySelector('.k-err'), btn = f.querySelector('button[type=submit]');
      err.textContent = ''; btn.disabled = true;
      try{
        const body = { title:f.title.value, dateFrom:f.dfrom.value, dateTo:f.dto.value, place:f.place.value, description:f.description.value, url:f.url.value };
        if(ev.editId) await send('PUT', '/api/events/' + ev.editId, body);
        else{ if(ev.photo) body.photo = ev.photo; await send('POST', '/api/events', body); }
        eClose(); await loadEvents();
      }catch(e2){ err.textContent = e2.message; }
      finally{ btn.disabled = false; }
    });
    async function onClick(e){
      const jmp = e.target.closest('[data-jump]');
      if(jmp){ e.preventDefault(); const t = eEl('sraz-' + jmp.dataset.jump); if(t) t.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      const ph = e.target.closest('[data-photo]');
      if(ph){ e.preventDefault(); lightbox(ph.href); return; }
      const art = e.target.closest('.k-event'); if(!art) return;
      const jn = e.target.closest('[data-join]');
      if(jn){
        if(!me){ askLoginFor('Účast se potvrzuje po přihlášení.'); return; }
        const on = !jn.classList.contains('on');
        try{
          const d = await send(on ? 'POST' : 'DELETE', '/api/events/' + art.dataset.eid + '/join');
          jn.classList.toggle('on', d.joined); jn.textContent = d.joined ? 'Zúčastním se ✓' : 'Zúčastním se';
          const g = art.querySelector('.k-going'); g.dataset.n = d.going; g.textContent = 'Jedou: ' + goingTxt(d.going).toLowerCase();
          const gb = art.querySelector('.k-glist'); gb.dataset.loaded = ''; if(!gb.hidden) { gb.hidden = true; }
          loadNextOnly();
        }catch(e2){ alert(e2.message); }
        return;
      }
      const go = e.target.closest('[data-going]');
      if(go){
        const gb = art.querySelector('.k-glist');
        if(!gb.hidden){ gb.hidden = true; return; }
        gb.hidden = false;
        if(gb.dataset.loaded) return;
        gb.innerHTML = '<p class="k-empty">Načítám…</p>';
        try{ const names = await api('/api/events/' + art.dataset.eid + '/going'); gb.innerHTML = names.length ? '<p class="k-gnames"></p>' : '<p class="k-empty">Zatím nikdo.</p>'; if(names.length) gb.firstChild.textContent = names.join(', '); gb.dataset.loaded = '1'; }
        catch(e2){ gb.innerHTML = '<p class="k-empty">' + esc(e2.message) + '</p>'; }
        return;
      }
      const ed = e.target.closest('[data-eedit]');
      if(ed){
        const d = JSON.parse(art.dataset.ev); eClose();
        f.title.value = d.title; f.dfrom.value = d.date_from; f.dto.value = d.date_to && d.date_to !== d.date_from ? d.date_to : ''; f.place.value = d.place; f.description.value = d.description || ''; f.url.value = d.url || '';
        ev.editId = Number(ed.dataset.eedit); f.querySelector('.k-files').hidden = true; f.querySelector('button[type=submit]').textContent = 'Uložit změny';
        f.hidden = false; f.scrollIntoView({ block:'nearest' }); f.title.focus(); return;
      }
      const dl = e.target.closest('[data-edel]');
      if(dl){
        const run = async () => { try{ await send('DELETE', '/api/events/' + dl.dataset.edel); art.remove(); loadNextOnly(); }catch(e2){ alert(e2.message); } };
        if(window.CendurHeader && window.CendurHeader.ask) window.CendurHeader.ask({ title:'Smazat akci?', msg:'Akce zmizí i s potvrzenými účastmi.', yes:{ label:'Smazat', fn:run } });
        else if(confirm('Smazat akci?')) run();
      }
    }
    eEl('srazy').addEventListener('click', onClick);
  })();
  async function loadNextOnly(){ try{ const d = await api('/api/events'); renderNext(d.events); }catch(e){} }
  function askLoginFor(msg){
    const go = () => { location.href = 'index.html?next=' + encodeURIComponent('komunita.html#srazy'); };
    if(window.CendurHeader && window.CendurHeader.ask) window.CendurHeader.ask({ title:'Přihlášení', msg, yes:{ label:'Přihlásit se', fn:go } });
    else go();
  }


  // ---------- Místa (v4.70) ----------
  const PCATS = { vyhlidka:'Vyhlídka', obcerstveni:'Občerstvení', terenni:'Terénní zajímavost', pamatka:'Památka', priroda:'Příroda', opustene:'Opuštěné místo', ostatni:'Ostatní' };
  const pl = { loaded:false, cat:'', oldest:0, editId:0, files:[] };
  function pmapLink(p){ return 'https://mapy.com/cs/zakladni?q=' + encodeURIComponent(p.lat != null ? p.lat + ',' + p.lon : p.locality); }
  function placeEl(p){
    const art = document.createElement('article'); art.className = 'k-post k-place'; art.dataset.pid = p.id;
    art.dataset.pl = JSON.stringify({ name:p.name, category:p.category, locality:p.locality, lat:p.lat, lon:p.lon, description:p.description, url:p.url });
    const h = document.createElement('h3'); h.textContent = p.name; art.appendChild(h);
    const cat = document.createElement('div'); cat.className = 'k-pcat'; cat.textContent = PCATS[p.category] || 'Ostatní'; art.appendChild(cat);
    const loc = document.createElement('div'); loc.className = 'k-eplace';
    if(p.locality) loc.appendChild(document.createTextNode(p.locality + ' · '));
    const ml = document.createElement('a'); ml.href = pmapLink(p); ml.target = '_blank'; ml.rel = 'noopener'; ml.textContent = 'na mapě'; loc.appendChild(ml);
    if(p.lat != null){ const c = document.createElement('span'); c.className = 'k-coords'; c.textContent = ' · ' + Number(p.lat).toFixed(5) + ', ' + Number(p.lon).toFixed(5); loc.appendChild(c); }
    art.appendChild(loc);
    const meta = document.createElement('div'); meta.className = 'k-pmeta';
    meta.textContent = 'Přidal ' + (p.nick || 'smazaný účet') + roleTag(p.role) + ' · ' + fmtDate(p.created_at);
    if(me && (isMod() || p.user_id === meId)){
      const ed = document.createElement('button'); ed.type = 'button'; ed.className = 'k-del k-edit'; ed.textContent = 'Upravit'; ed.dataset.pedit = p.id;
      const del = document.createElement('button'); del.type = 'button'; del.className = 'k-del'; del.textContent = 'Smazat'; del.dataset.pdel = p.id;
      meta.appendChild(ed); meta.appendChild(del);
    }
    art.appendChild(meta);
    if(p.description){ const t = document.createElement('div'); t.className = 'k-ptext'; t.textContent = p.description; art.appendChild(t); }
    if(p.url){ const q = document.createElement('p'); q.className = 'k-elink'; const a = document.createElement('a'); a.href = p.url; a.target = '_blank'; a.rel = 'noopener nofollow'; a.textContent = p.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60); q.appendChild(a); art.appendChild(q); }
    if(p.photos && p.photos.length){
      const g = document.createElement('div'); g.className = 'k-pgal' + (p.photos.length === 1 ? ' one' : '');
      p.photos.forEach(id => {
        const a = document.createElement('a'); a.href = API() + '/api/places/photo/' + id; a.className = 'k-ph'; a.dataset.photo = '1';
        const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.alt = p.name; im.src = a.href; a.appendChild(im); g.appendChild(a);
      });
      art.appendChild(g);
    }
    const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'k-cbtn'; cb.dataset.pcomments = p.id; cb.textContent = 'Komentáře (' + (p.comments || 0) + ')'; art.appendChild(cb);
    const cs = document.createElement('div'); cs.className = 'k-comments'; cs.hidden = true; art.appendChild(cs);
    return art;
  }
  async function loadPlaces(more){
    const box = eEl('k-places'), btn = eEl('k-pmore');
    try{
      const d = await api('/api/places?' + (pl.cat ? 'cat=' + pl.cat + '&' : '') + (more && pl.oldest ? 'before=' + pl.oldest : ''));
      if(!more){ box.innerHTML = ''; pl.oldest = 0; }
      d.places.forEach(p => { box.appendChild(placeEl(p)); pl.oldest = p.id; });
      if(!box.children.length) box.innerHTML = '<p class="k-empty">Zatím tu nic není.' + (pl.cat ? '' : ' Přidej první místo.') + '</p>';
      btn.hidden = !d.more;
    }catch(e){ if(!more) fail(box, e); }
  }
  function drawPThumbs(){
    const f = eEl('k-pform'), th = f.querySelector('.k-thumbs'); th.innerHTML = '';
    pl.files.forEach((u, i) => {
      const w = document.createElement('div'); w.className = 'k-th';
      const im = document.createElement('img'); im.src = u; im.alt = '';
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.dataset.rm = i; x.setAttribute('aria-label', 'Odebrat fotku');
      w.appendChild(im); w.appendChild(x); th.appendChild(w);
    });
    f.querySelector('.k-fhint').textContent = pl.files.length ? pl.files.length + ' / 4' : 'Nejvýš 4 fotky';
  }
  function pClose(){
    const f = eEl('k-pform'); f.hidden = true; f.reset(); pl.files = []; pl.editId = 0;
    f.querySelector('.k-err').textContent = ''; f.querySelector('.k-files').hidden = false; f.querySelector('button[type=submit]').textContent = 'Přidat místo'; drawPThumbs();
  }
  function parseCoords(v){
    v = String(v || '').trim(); if(!v) return { lat:'', lon:'' };
    const m = v.replace(/[°NEne]/g, ' ').replace(/,/g, ' ').match(/-?\d+(?:\.\d+)?/g);
    if(!m || m.length !== 2) return null;
    return { lat:m[0], lon:m[1] };
  }
  async function openPlaces(){
    if(pl.loaded) return;
    pl.loaded = true;
    eEl('k-pbar').hidden = !me;
    loadPlaces(false);
  }
  (function(){
    const f = eEl('k-pform'), chips = eEl('k-pcats');
    f.category.innerHTML = Object.keys(PCATS).map(k => '<option value="' + k + '">' + PCATS[k] + '</option>').join('');
    chips.innerHTML = '<button type="button" class="k-chip on" data-cat="">Vše</button>' + Object.keys(PCATS).map(k => '<button type="button" class="k-chip" data-cat="' + k + '">' + PCATS[k] + '</button>').join('');
    chips.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if(!b) return;
      pl.cat = b.dataset.cat; chips.querySelectorAll('.k-chip').forEach(c => c.classList.toggle('on', c === b));
      eEl('k-places').innerHTML = '<p class="k-empty">Načítám…</p>'; loadPlaces(false);
    });
    eEl('k-pnew').addEventListener('click', () => { pClose(); f.hidden = false; drawPThumbs(); f.name.focus(); });
    eEl('k-pcancel').addEventListener('click', pClose);
    eEl('k-pmore').addEventListener('click', () => loadPlaces(true));
    f.photos.addEventListener('change', async () => {
      const err = f.querySelector('.k-err'); err.textContent = '';
      const list = Array.from(f.photos.files); f.photos.value = '';
      for(const file of list){
        if(pl.files.length >= 4){ err.textContent = 'Nejvýš 4 fotky.'; break; }
        try{ pl.files.push(await shrink(file)); }catch(e){ err.textContent = e.message; }
      }
      drawPThumbs();
    });
    f.querySelector('.k-thumbs').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if(!b) return; pl.files.splice(Number(b.dataset.rm), 1); drawPThumbs(); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const err = f.querySelector('.k-err'), btn = f.querySelector('button[type=submit]');
      err.textContent = '';
      const c = parseCoords(f.coords.value);
      if(!c){ err.textContent = 'Souřadnice zadej jako dvě čísla, např. 50.5123, 15.4321.'; return; }
      btn.disabled = true;
      try{
        const body = { name:f.name.value, category:f.category.value, locality:f.locality.value, lat:c.lat, lon:c.lon, description:f.description.value, url:f.url.value };
        if(pl.editId) await send('PUT', '/api/places/' + pl.editId, body);
        else{ body.photos = pl.files; await send('POST', '/api/places', body); }
        pClose(); await loadPlaces(false);
      }catch(e2){ err.textContent = e2.message; }
      finally{ btn.disabled = false; }
    });
    const box = eEl('k-places');
    box.addEventListener('submit', async e => {
      const cf = e.target.closest('.k-cform'); if(!cf) return;
      e.preventDefault();
      const art = cf.closest('.k-place'), ta = cf.querySelector('textarea'), err = cf.querySelector('.k-err'), btn = cf.querySelector('button');
      if(!ta.value.trim()) return;
      err.textContent = ''; btn.disabled = true;
      try{
        const c = await send('POST', '/api/places/' + art.dataset.pid + '/comments', { text:ta.value });
        const lst = art.querySelector('.k-clist'); const em = lst.querySelector('.k-empty'); if(em) em.remove();
        lst.appendChild(commentEl(c)); ta.value = ''; setCount(art, lst.querySelectorAll('.k-cm').length);
      }catch(e2){ err.textContent = e2.message; }
      finally{ btn.disabled = false; }
    });
    box.addEventListener('click', async e => {
      const ph = e.target.closest('[data-photo]');
      if(ph){ e.preventDefault(); lightbox(ph.href); return; }
      const art = e.target.closest('.k-place'); if(!art) return;
      const cb = e.target.closest('[data-pcomments]');
      if(cb){ toggleComments(art, '/api/places/' + art.dataset.pid + '/comments'); return; }
      const dc = e.target.closest('[data-delcm]');
      if(dc){
        try{
          await send('DELETE', '/api/places/comments/' + dc.dataset.delcm);
          dc.closest('.k-cm').remove();
          const n = art.querySelectorAll('.k-cm').length; setCount(art, n);
          if(!n) art.querySelector('.k-clist').innerHTML = '<p class="k-empty">Zatím bez komentářů.</p>';
        }catch(e2){ alert(e2.message); }
        return;
      }
      const ed = e.target.closest('[data-pedit]');
      if(ed){
        const d = JSON.parse(art.dataset.pl); pClose();
        f.name.value = d.name; f.category.value = d.category; f.locality.value = d.locality || '';
        f.coords.value = d.lat != null ? d.lat + ', ' + d.lon : ''; f.description.value = d.description || ''; f.url.value = d.url || '';
        pl.editId = Number(ed.dataset.pedit); f.querySelector('.k-files').hidden = true; f.querySelector('button[type=submit]').textContent = 'Uložit změny';
        f.hidden = false; f.scrollIntoView({ block:'nearest' }); f.name.focus(); return;
      }
      const dl = e.target.closest('[data-pdel]');
      if(dl){
        const run = async () => { try{ await send('DELETE', '/api/places/' + dl.dataset.pdel); art.remove(); }catch(e2){ alert(e2.message); } };
        if(window.CendurHeader && window.CendurHeader.ask) window.CendurHeader.ask({ title:'Smazat místo?', msg:'Místo zmizí i s fotkami a komentáři.', yes:{ label:'Smazat', fn:run } });
        else if(confirm('Smazat místo?')) run();
      }
    });
  })();

  showTab();
  load().then(() => { loaded = true; showTab(); });
})();
