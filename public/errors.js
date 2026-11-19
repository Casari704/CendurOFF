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
      if(/(google|bing|yandex|duckduck|baidu|apple|ahrefs|semrush|petal|mj12|dot)bot|\bbot\b|crawler|spider|slurp|Lighthouse|HeadlessChrome/i.test(navigator.userAgent || '')) return;   // vyhledávací roboti (Googlebot apod.)
      if(/^Script error\.?$/.test(message)) return;                       // cizí skript bez detailu
      if(/Failed to fetch|NetworkError|Load failed|network error/i.test(message)) return;   // výpadek sítě není chyba webu
      if(stack && /(chrome|moz|safari)-extension:\/\//.test(stack)) return;  // rozšíření prohlížeče
      sent.add(message); count++;
      let appVersion = null;
      try{ if(window.CendurApp && window.CendurApp.version) appVersion = String(window.CendurApp.version()); }catch(e){}
      let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
      const api = window.CENDUROFF_API_URL || 'https://api.cenduroff.cz';
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
  // v4.58: server omezuje nepřihlášené na mapová data; po vyčerpání limitu odpoví 429 s needsLogin
  // a web nabídne přihlášení (nejvýš jednou za minutu). Vrací true, když šlo o tohle omezení.
  let loginAskedAt = 0;
  async function loginNeeded(res){
    try{
      if(!res || res.status !== 429) return false;
      const j = await res.clone().json().catch(() => null);
      if(!j || !j.needsLogin) return false;
      if(Date.now() - loginAskedAt > 60000){
        loginAskedAt = Date.now();
        if(typeof window.CendurAskLogin === 'function') window.CendurAskLogin(j.error);
        else if(window.CendurHeader && window.CendurHeader.ask) window.CendurHeader.ask({
          title: 'Přihlas se pro další mapová data', msg: j.error || 'Pro další mapová data se přihlas.',
          yes: { label: 'Přihlásit se', fn: () => { location.href = 'index.html?login=1'; } }
        });
      }
      return true;
    }catch(e){ return false; }
  }
  window.CendurLoginNeeded = loginNeeded;
  // v4.58: požadavky na mapová data posílají přihlášení (token) – přihlášený člen pak limit nemá
  window.CendurAuthInit = function(o){
    const init = Object.assign({ credentials:'include' }, o);
    let t = null; try{ t = localStorage.getItem('cenduroff.token'); }catch(e){}
    if(t) init.headers = Object.assign({}, init.headers, { Authorization:'Bearer ' + t });
    return init;
  };
  window.CendurErrors = { report };
})();
