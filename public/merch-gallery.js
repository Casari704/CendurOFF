// CendurOFF – posuvná galerie merche (v4.8)
// <div class="m-gallery mg" data-merch-folder="roleplay"> … </div>
// Ukáže VŠECHNY obrázky ve složce public/img/merch/<složka>/ na GitHubu – názvy souborů nehrají roli,
// řadí se podle názvu (kdo chce pořadí, dá na začátek číslo: 01-…, 02-…).
// Seznam souborů dává GitHub API; když nejde načíst, zůstanou obrázky vepsané přímo v HTML.
(function(){
  const REPO = 'Casari704/CendurOFF', BRANCH = 'main', BASE = 'public/img/merch/';
  const IMG = /\.(png|jpe?g|webp|gif|avif)$/i;
  const TTL = 10 * 60000;

  async function listFolder(folder){
    const key = 'cenduroff.merch.' + folder;
    try{ const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if(c && Date.now() - c.t < TTL) return c.files; }catch(e){}
    const res = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + BASE + folder + '?ref=' + BRANCH, { headers:{ Accept:'application/vnd.github+json' } });
    if(!res.ok) throw new Error('GitHub ' + res.status);
    const data = await res.json();
    const files = (Array.isArray(data) ? data : []).filter(f => f.type === 'file' && IMG.test(f.name)).map(f => f.name)
      .sort((a, b) => a.localeCompare(b, 'cs', { numeric:true, sensitivity:'base' }));
    try{ sessionStorage.setItem(key, JSON.stringify({ t:Date.now(), files })); }catch(e){}
    return files;
  }
  function alt(name, label){
    const t = name.replace(IMG, '').replace(/^\d+[\s._-]*/, '').replace(/[_-]+/g, ' ').trim();
    return (label ? label + ' – ' : '') + (t || 'motiv');
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }

  function setup(el){
    const track = el.querySelector('.mg-track'), prev = el.querySelector('.mg-prev'), next = el.querySelector('.mg-next');
    const step = () => { const i = track.querySelector('img'); return i ? i.getBoundingClientRect().width + 10 : track.clientWidth * 0.8; };
    function update(){
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2; next.disabled = track.scrollLeft >= max;
      el.classList.toggle('mg-static', max <= 0);
    }
    prev.addEventListener('click', () => track.scrollBy({ left:-step(), behavior:'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left:step(), behavior:'smooth' }));
    track.addEventListener('scroll', update, { passive:true });
    window.addEventListener('resize', update);
    track.addEventListener('load', update, true);
    update();
    return update;
  }

  document.querySelectorAll('[data-merch-folder]').forEach(el => {
    const update = setup(el);
    const folder = el.dataset.merchFolder, label = el.dataset.merchLabel || '';
    listFolder(folder).then(files => {
      if(!files.length) return;
      el.querySelector('.mg-track').innerHTML = files.map(f =>
        '<img src="' + BASE + folder + '/' + encodeURIComponent(f) + '" alt="' + esc(alt(f, label)) + '" loading="lazy" onerror="this.remove()">').join('');
      el.querySelector('.mg-track').scrollLeft = 0;
      update();
    }).catch(() => { /* zůstanou obrázky z HTML */ });
  });
})();
