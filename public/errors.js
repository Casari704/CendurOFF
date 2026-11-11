// ---------------------------------------------------------------
// CendurOFF – hlášení chyb do adminu (v4.3), na všech stránkách
// Zachytí chybu skriptu (i nezachycenou chybu v async kódu) a pošle ji na server; admin ji
// uvidí v admin.html → „Chyby z telefonů“. Stejná chyba se z jedné stránky pošle jen jednou,
// nejvýš 10 hlášení na jedno otevření stránky. Chyby rozšíření prohlížeče se ignorují.
// ---------------------------------------------------------------
(function(){
  const sent = new Set();
  let count = 0;
  function report(message, stack){
    try{
      message = String(message || '').slice(0, 500);
      if(!message || count >= 10 || sent.has(message)) return;
      if(/^Script error\.?$/.test(message)) return;                       // cizí skript bez detailu
      if(/Failed to fetch|NetworkError|Load failed|network error/i.test(message)) return;   // výpadek sítě není chyba webu
      if(stack && /(chrome|moz|safari)-extension:\/\//.test(stack)) return;  // rozšíření prohlížeče
      sent.add(message); count++;
      let appVersion = null;
      try{ if(window.CendurApp && window.CendurApp.version) appVersion = String(window.CendurApp.version()); }catch(e){}
      let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
      const api = window.CENDUROFF_API_URL || 'https://cenduroff-web.up.railway.app';
      fetch(api + '/api/errors', {
        method:'POST', credentials:'include', keepalive:true,
        headers: Object.assign({ 'Content-Type':'application/json' }, t ? { Authorization:'Bearer ' + t } : {}),
        body: JSON.stringify({
          page: (location.pathname.split('/').pop() || 'index.html') + location.search,
          message, stack: stack ? String(stack).slice(0, 4000) : null,
          ua: navigator.userAgent, appVersion,
          webVersion: window.CENDUROFF_WEB_VERSION || null
        })
      }).catch(() => {});
    }catch(e){}
  }
  window.addEventListener('error', e => {
    if(!e || (!e.message && !e.error)) return;      // chyba načtení obrázku apod.
    report(e.message || (e.error && e.error.message), e.error && e.error.stack ? e.error.stack : (e.filename ? e.filename + ':' + e.lineno + ':' + e.colno : null));
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e && e.reason;
    if(r && (r.needsLogin || r.name === 'AbortError')) return;   // očekávané (přihlášení, zrušený požadavek)
    if(r && r.offline) return;                                    // bez signálu
    report(r && r.message ? r.message : String(r), r && r.stack);
  });
  window.CendurErrors = { report };
})();
