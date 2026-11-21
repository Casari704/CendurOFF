// ---------------------------------------------------------------
// CendurOFF – Komunita (komunita.html), v4.62: TOP uživatelé a TOP trasy
// Data: /api/community/users a /api/community/routes (jen pro přihlášené členy)
// ---------------------------------------------------------------
(function(){
  const API = () => window.CENDUROFF_API_URL || 'https://api.cenduroff.cz';
  const R = window.CendurRider;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = n => (Number(n) || 0).toLocaleString('cs-CZ');
  let meId = null;

  async function api(path){
    const o = { credentials:'include' };
    try{ const t = localStorage.getItem('cenduroff.token'); if(t) o.headers = { Authorization:'Bearer ' + t }; }catch(e){}
    const res = await fetch(API() + path, o);
    let data = null; try{ data = await res.json(); }catch(e){}
    if(!res.ok){ const err = new Error((data && data.error) || 'Něco se pokazilo.'); err.status = res.status; throw err; }
    return data;
  }
  function needLogin(box){
    box.innerHTML = '<p class="k-login k-empty">Žebříčky jsou jen pro přihlášené členy. <a href="index.html?next=' + encodeURIComponent('komunita.html') + '">Přihlásit se</a></p>';
  }
  function fail(box, e){
    if(e.status === 401 || e.status === 429) needLogin(box); else box.innerHTML = '<p class="k-empty">' + esc(e.message) + '</p>';
  }

  // ---------- TOP uživatelé ----------
  function renderUsers(list){
    const box = document.getElementById('k-users-box');
    const rows = list.map(u => {
      const st = u.stats || {};
      const rank = R ? R.badgeFor(st.km) : null;
      const ach = R ? R.achievements(st, u.earned).filter(a => a.got) : [];
      return { id:u.id, nick:u.nick, km:Number(st.km) || 0, ridden:st.ridden || 0, own:st.ownRoutes || 0, rank, ach };
    }).sort((a, b) => (b.km - a.km) || (b.ach.length - a.ach.length) || String(a.nick).localeCompare(String(b.nick), 'cs'));
    if(!rows.length){ box.innerHTML = '<p class="k-empty">Zatím tu nikdo není.</p>'; return; }
    box.innerHTML = '<table class="k-t"><thead><tr><th class="num">#</th><th>Nick</th><th class="num">Najeto</th><th class="num">Projeté trasy</th><th class="num">Přidané trasy</th><th>Hodnost</th><th>Odznaky</th></tr></thead><tbody>' +
      rows.map((u, i) => '<tr class="' + (i === 0 ? 'top1 ' : '') + (u.id === meId ? 'me' : '') + '"><td class="pos num">' + (i + 1) + '.</td><td class="nick">' + esc(u.nick) + '</td>' +
        '<td class="num big">' + (R ? R.fmtKm(u.km) : num(u.km) + ' km') + '</td><td class="num">' + num(u.ridden) + '</td><td class="num">' + num(u.own) + '</td>' +
        '<td>' + (u.rank ? u.rank.icon + ' ' + esc(u.rank.name) : '') + '</td>' +
        '<td class="k-ach">' + (u.ach.length ? u.ach.map(a => '<span title="' + esc(a.name) + '">' + a.icon + '</span>').join('') : '—') + '</td></tr>').join('') +
      '</tbody></table>';
  }

  // ---------- TOP trasy ----------
  const TYPE = { transport:'Transport', cenduro:'Cenduro', offroad:'Offroad' };
  function renderRoutes(list){
    const box = document.getElementById('k-routes-box');
    const rows = list.slice().sort((a, b) => ((b.rides || 0) - (a.rides || 0)) || ((b.stars || 0) - (a.stars || 0)));
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
    try{ const me = await api('/api/auth/me'); meId = me && me.id; }catch(e){ needLogin(ub); needLogin(rb); return; }
    api('/api/community/users').then(renderUsers).catch(e => fail(ub, e));
    api('/api/community/routes').then(renderRoutes).catch(e => fail(rb, e));
  }
  load();
})();
