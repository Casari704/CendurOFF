// ---------------------------------------------------------------
// CendurOFF – registrace offline režimu (service worker) a hláška o nové verzi (v2.5)
// Načítá se na všech stránkách. Stránku nikdy neobnoví sama (ať nezmizí rozjetá navigace) –
// jen ukáže pruh „Je dostupná nová verze – Obnovit“.
// ---------------------------------------------------------------
(function(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  let reloading = false;
  function banner(reg){
    if(document.getElementById('pwa-update')) return;
    const b = document.createElement('div');
    b.id = 'pwa-update';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5000;display:flex;align-items:center;gap:10px;' +
      'background:#172218;color:#EFEAD8;border:2px solid #C79A3E;border-radius:10px;padding:8px 10px 8px 14px;font:600 14px Roboto,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:92vw;';
    b.innerHTML = '<span>Je dostupná nová verze CendurOFF.</span>' +
      '<button type="button" id="pwa-update-go" style="border:0;border-radius:6px;background:#C79A3E;color:#172218;font:800 14px \'Exo 2\',sans-serif;padding:8px 12px;cursor:pointer">Obnovit</button>' +
      '<button type="button" id="pwa-update-x" aria-label="Později" style="border:0;background:none;color:#EFEAD8;font-size:18px;cursor:pointer;padding:4px 6px">×</button>';
    document.body.appendChild(b);
    document.getElementById('pwa-update-go').addEventListener('click', () => {
      if(reg.waiting){ reloading = true; reg.waiting.postMessage('skipWaiting'); }
      else location.reload();
    });
    document.getElementById('pwa-update-x').addEventListener('click', () => b.remove());
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      if(reg.waiting && navigator.serviceWorker.controller) banner(reg);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if(!w) return;
        w.addEventListener('statechange', () => {
          // nová verze je připravená a stránku už řídí ta stará → nabídnout obnovení
          if(w.state === 'installed' && navigator.serviceWorker.controller) banner(reg);
        });
      });
      // kontrola nové verze i když aplikace běží dlouho (každých 30 min a při návratu do aplikace)
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if(reloading) location.reload(); });
  });
})();
