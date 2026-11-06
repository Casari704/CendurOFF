// ---------------------------------------------------------------
// CendurOFF – zvuky v navigaci (v3.1)
//
//  - instrukce:      Rally gong + hlas telefonu („Za 90 metrů ostře vpravo“)
//  - nebezpečí:      místo gongu Rally buzzer (+ hlas „…, nebezpečí“)
//  - dvě instrukce blízko u sebe: jedna hláška „… a hned potom …“, u druhé už gong nezní
//  - mimo trasu:     jemná výstraha + hlas „Jsi mimo trasu, cype!“
//  - když telefon český hlas nemá, zazní jen tóny
//  - zapnutí / vypnutí: Můj účet → Zvuky v navigaci (uloženo v telefonu)
//
// Tóny se generují přímo v prohlížeči (žádné soubory, funguje i offline).
// Hlas: v prohlížeči Web Speech (jen když má český hlas), v aplikaci pro Android
// převod textu na řeč z telefonu (window.CendurApp.speak).
// ---------------------------------------------------------------
(function(){
  const KEY = 'cenduroff.sound';
  let ctx = null;

  function enabled(){ try{ return localStorage.getItem(KEY) !== 'off'; }catch(e){ return true; } }
  function setEnabled(on){ try{ localStorage.setItem(KEY, on ? 'on' : 'off'); }catch(e){} }

  // zvuk v prohlížeči smí začít až po klepnutí uživatele – volat z tlačítek „Jet“ / „NAVIGOVAT“
  function unlock(){
    try{
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if(ctx.state === 'suspended') ctx.resume();
      // tichý „prázdný“ tón, ať se audio v telefonu opravdu odemkne
      const o = ctx.createOscillator(), g = ctx.createGain();
      g.gain.value = 0.0001; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.05);
    }catch(e){}
    if('speechSynthesis' in window){ try{ speechSynthesis.getVoices(); }catch(e){} }
  }

  // v3.6: tóny o ~15 % tišší, ať nepřebíjejí hlas telefonu (1 = původní hlasitost)
  const TONE_VOLUME = 0.85;
  function tone(f, t0, dur, type, vol, f2){
    vol = (vol || 0.3) * TONE_VOLUME;
    const t = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.setValueAtTime(vol || 0.3, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // délky v sekundách – hlas začne až po doznění tónu
  const SOUNDS = {
    gong:   { len: 0.85, play(){ tone(660, 0, 0.45, 'triangle', 0.45); tone(990, 0.22, 0.6, 'triangle', 0.45); } },
    buzzer: { len: 1.15, play(){ tone(220, 0, 0.25, 'square', 0.24); tone(220, 0.32, 0.25, 'square', 0.24); tone(220, 0.64, 0.45, 'square', 0.26); } },
    gentle: { len: 0.75, play(){ tone(988, 0, 0.25, 'triangle', 0.4); tone(740, 0.28, 0.4, 'triangle', 0.4); } }
  };

  // --- hlas ---
  function czVoice(){
    if(!('speechSynthesis' in window)) return null;
    try{ return speechSynthesis.getVoices().find(v => /^cs([-_]|$)/i.test(v.lang)) || null; }catch(e){ return null; }
  }
  function appVoice(){ try{ return !!(window.CendurApp && window.CendurApp.hasCzechVoice && window.CendurApp.hasCzechVoice()); }catch(e){ return false; } }
  function hasVoice(){ return appVoice() || !!czVoice(); }
  function speakNow(text){
    if(appVoice()){ try{ window.CendurApp.speak(text); }catch(e){} return; }
    const v = czVoice();
    if(!v) return;                       // bez českého hlasu raději nic (anglická výslovnost by byla k ničemu)
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = 1.05;
      speechSynthesis.speak(u);
    }catch(e){}
  }

  let busyUntil = 0, pending = null;
  // zvuk + hlas jako jedna hláška; další počká, až tahle dozní
  function announce(sound, text){
    if(!enabled()) return;
    unlock();
    if(!ctx) return;
    const now = Date.now();
    if(now < busyUntil){
      // přednost má poslední hláška (je aktuálnější); starší čekající se zahodí
      clearTimeout(pending);
      pending = setTimeout(() => announce(sound, text), busyUntil - now + 50);
      return;
    }
    const s = SOUNDS[sound] || SOUNDS.gong;
    s.play();
    const wait = Math.round(s.len * 1000);
    busyUntil = now + wait + (text ? 2200 : 300);
    if(text) setTimeout(() => speakNow(text), wait);
  }

  // --- texty hlášek ---
  function distWords(m){
    if(m >= 1000){
      const km = Math.round(m / 100) / 10;
      return 'Za ' + String(km).replace('.', ',') + ' kilometru';
    }
    return 'Za ' + Math.max(10, Math.round(m / 10) * 10) + ' metrů';
  }
  function itemWords(it){
    const RB = window.CendurRB;
    let t = RB ? String(RB.label(it) || '') : '';
    t = t.toLowerCase();
    if(it.kind === 'finish') t = 'cíl';
    if(it.danger) t += ', nebezpečí';
    return t;
  }

  // ---------------------------------------------------------------
  // Hlídač instrukcí pro jednu jízdu (Roadbook NAVI i roh roadbooku v Atlasu)
  //   update(vis, pos, speedMs, offRoute) – volat při každé poloze
  //   vis = seřazené instrukce s .s (m od startu), pos = poloha na trase (m)
  // ---------------------------------------------------------------
  const WARN_SEC = 8, WARN_MIN = 40, WARN_MAX = 250, OFF_REPEAT_MS = 30000;
  function createGuide(){
    const done = new Set();
    let lastPos = null, wasOff = false, lastOffAt = 0, onSince = 0;
    return {
      reset(){ done.clear(); lastPos = null; wasOff = false; lastOffAt = 0; },
      update(vis, pos, speedMs, offRoute){
        if(!vis || !vis.length || pos == null) return;
        const now = Date.now();
        // mimo trasu: jen při vyjetí (a nejvýš jednou za 30 s)
        if(offRoute){
          if(!wasOff && now - lastOffAt > OFF_REPEAT_MS){ window.CendurSound.announce('gentle', 'Jsi mimo trasu, cype!'); lastOffAt = now; }
          wasOff = true;
          return;
        }
        if(wasOff){ if(!onSince) onSince = now; if(now - onSince < 3000) return; }
        wasOff = false; onSince = 0;
        // první poloha / skok (ruční korekce, návrat): instrukce za námi označit jako hotové, nic nehrát
        if(lastPos == null || Math.abs(pos - lastPos) > 300 || pos < lastPos - 15){
          vis.forEach((it, i) => { if(it.s <= pos + 5) done.add(i); });
          lastPos = pos;
          return;
        }
        lastPos = pos;
        const warn = Math.max(WARN_MIN, Math.min(WARN_MAX, (speedMs || 0) * WARN_SEC));
        const i = vis.findIndex((it, k) => !done.has(k) && it.s > pos + 5);
        if(i < 0) return;
        // instrukce, které jsme mezitím projeli bez hlášky, už nehlásit
        for(let k = 0; k < i; k++) done.add(k);
        const it = vis[i], d = it.s - pos;
        if(d > warn || it.kind === 'start') return;
        done.add(i);
        let text = distWords(d) + ' ' + itemWords(it);
        let sound = it.danger ? 'buzzer' : 'gong';
        // další instrukce těsně za ní → jedna hláška „… a hned potom …“, u druhé už gong nezní
        const nx = vis[i + 1];
        if(nx && nx.s - it.s < warn){
          done.add(i + 1);
          text += ', a hned potom ' + itemWords(nx);
          if(nx.danger) sound = 'buzzer';
        }
        window.CendurSound.announce(sound, text + '.');
      }
    };
  }

  window.CendurSound = { enabled, setEnabled, unlock, announce, hasVoice, createGuide };
})();
