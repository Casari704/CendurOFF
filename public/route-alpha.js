// ---------------------------------------------------------------
// Průhlednost tras (v4.40) – sdílené pro Atlas, GPX planner, Roadbook editor i jízdu podle roadbooku
// - volba v nabídce mapy: 0 / 25 / 50 / 75 %, platí na všech stránkách (localStorage)
// - průhlednost se nastavuje celé vrstvě s trasami (CSS proměnná --route-alpha), takže čára
//   i její bílý okraj zprůhlední stejně a pod trasou je vidět cesta
// ---------------------------------------------------------------
(function(){
  const KEY = 'routeAlpha';
  const STEPS = [0, 25, 50, 75];
  let val = (() => { try{ const v = parseInt(localStorage.getItem(KEY), 10); return STEPS.includes(v) ? v : 0; }catch(e){ return 0; } })();
  let row = null;

  function apply(){ document.documentElement.style.setProperty('--route-alpha', String(1 - val / 100)); }
  function sync(){
    if(!row) return;
    row.querySelectorAll('[data-ra]').forEach(b => { const on = +b.dataset.ra === val; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  }
  apply();

  window.CendurRouteAlpha = {
    get: () => val,
    attach(menu){
      if(!menu || menu.querySelector('.ra-row')) return;
      menu.insertAdjacentHTML('beforeend',
        '<div class="layer-menu-title layer-menu-sep">Průhlednost tras</div>' +
        '<div class="ra-row" role="radiogroup">' + STEPS.map(s => `<button type="button" data-ra="${s}" role="radio">${s} %</button>`).join('') + '</div>');
      row = menu.querySelector('.ra-row');
      row.addEventListener('click', e => {
        e.stopPropagation();   // nabídka zůstane otevřená
        const b = e.target.closest('[data-ra]'); if(!b) return;
        val = +b.dataset.ra;
        try{ localStorage.setItem(KEY, String(val)); }catch(err){}
        apply(); sync();
      });
      sync();
    }
  };
})();
