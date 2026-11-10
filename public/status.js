// ---------------------------------------------------------------
// CendurOFF – společné stavové hlášky (v4.1)
// Všechny hlášky (stav GPS, režim jízdy, mimo trasu, …) se ukazují na jednom místě – nahoře
// uprostřed pod sebou, stejným stylem. Důležitější hláška (menší prio) je vždy nahoře.
//
//   const st = CendurStatus.create(parent)      – parent = kam stack vložit (výchozí body)
//   st.set('gps',  { title:'📡 Slabý GPS', tone:'warn', prio:0 })
//   st.set('mode', { title:'Volná jízda', sub:'na trase: …', tone:'dark', prio:10 })
//   st.clear('gps')
//   CendurStatus.create(parent, { single:true }) – ukazuje jen nejdůležitější hlášku
//   … { keepLast:true } – poslední hláška zůstane v prvku i po zrušení (animace zajetí)
// tone: dark (černá), blue (vybraná trasa), warn (žlutá na černé), bad (červená)
// Doporučené prio: 0 GPS · 5 mimo trasu / proti směru · 10 režim (Volná jízda, Trasa: …)
// ---------------------------------------------------------------
(function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
  function create(parent, opt){
    opt = opt || {};
    const el = document.createElement('div');
    el.className = 'cs-stack' + (opt.className ? ' ' + opt.className : '');
    el.setAttribute('aria-live', 'polite');
    const host = parent || document.body;
    if(opt.prepend) host.prepend(el); else host.appendChild(el);
    const items = new Map();
    function render(){
      let list = [...items.entries()].sort((a, b) => (a[1].prio || 0) - (b[1].prio || 0));
      // single: jen jedna (nejdůležitější) hláška naráz – kde je málo místa (Roadbook NAVI)
      if(opt.single) list = list.slice(0, 1);
      // keepLast: poslední hláška zůstane v prvku, když už žádná není (kvůli animaci zajetí)
      if(!list.length && opt.keepLast && el.innerHTML){ el.dataset.empty = '1'; if(opt.onChange && ready) try{ opt.onChange(0); }catch(e){} return; }
      el.dataset.empty = list.length ? '' : '1';
      el.innerHTML = list.map(([k, it]) =>
        '<div class="cs-item cs-' + (it.tone || 'dark') + '" data-key="' + esc(k) + '"><b>' + esc(it.title) + '</b>' +
        (it.sub ? '<span>' + esc(it.sub) + '</span>' : '') + '</div>').join('');
      el.hidden = !list.length && !opt.keepLast;
      if(opt.onChange && ready) try{ opt.onChange(list.length); }catch(e){}
    }
    let ready = false;
    render();
    ready = true;
    return {
      el,
      set(key, it){
        const old = items.get(key);
        if(old && old.title === it.title && old.sub === it.sub && old.tone === it.tone && old.prio === it.prio) return;
        items.set(key, it); render();
      },
      clear(key){ if(items.delete(key)) render(); },
      has(key){ return items.has(key); },
      get count(){ return items.size; }
    };
  }
  window.CendurStatus = { create };
})();
