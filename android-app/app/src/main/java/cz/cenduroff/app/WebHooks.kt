package cz.cenduroff.app

/**
 * JavaScript, který aplikace vloží do každé stránky webu (po načtení).
 *  - Wake Lock: WebView ho neumí → náhrada přes CendurApp.keepScreenOn
 *  - stahování souborů (GPX z „blob:“ odkazů) → CendurApp.saveFile (uloží do Stažených)
 */
object WebHooks {
    val JS = """
(function(){
  if (window.__cendurAppHooks) return;
  window.__cendurAppHooks = true;
  var app = window.CendurApp;
  if (!app) return;

  // náhrada za navigator.wakeLock (displej nezhasne)
  if (!('wakeLock' in navigator)) {
    try {
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
        request: function(){
          app.keepScreenOn(true);
          return Promise.resolve({
            released: false,
            release: function(){ app.keepScreenOn(false); this.released = true; return Promise.resolve(); },
            addEventListener: function(){}, removeEventListener: function(){}
          });
        }
      }});
    } catch (e) {}
  }

  // stahování souborů z odkazů <a download href="blob:…">
  function save(a){
    var href = a.href || '';
    if (!/^(blob:|data:)/.test(href)) return false;
    var name = a.getAttribute('download') || 'soubor';
    fetch(href).then(function(r){ return r.blob(); }).then(function(b){
      var fr = new FileReader();
      fr.onload = function(){
        var s = String(fr.result);
        app.saveFile(name, b.type || 'application/octet-stream', s.substring(s.indexOf(',') + 1));
      };
      fr.readAsDataURL(b);
    });
    return true;
  }
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    if (this.hasAttribute('download') && save(this)) return;
    return origClick.apply(this, arguments);
  };
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a && save(a)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
""".trimIndent()
}
