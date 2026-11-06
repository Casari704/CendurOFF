# CendurOFF – Android aplikace v2 (telefon + Android Auto)

## Co aplikace dělá

- **Telefon:** celý web CendurOFF (Atlas NAVI, Atlas Planner, Roadbook NAVI…) v aplikaci.
  Web se načítá živě z internetu, takže **úpravy webu se do aplikace dostanou samy**.
  Bez signálu běží poslední stažená verze (offline režim webu).
  Aplikace k webu přidává: displej nezhasne při navigaci, GPX se ukládá do **Stažených**,
  výběr souborů (GPX, fotky) a poloha fungují jako v Chromu.
- **Android Auto (displej motorky / auta):** seznam roadbooků a jízda podle roadbooku
  (varianta 3 – velká aktuální instrukce, dvě další, žlutý pruh „DALŠÍ ZA“, tlačítka −50 / +50 / Konec).
  Roadbook se stáhne ze serveru a uloží do telefonu – pak jede i bez signálu.
  Roadbooky uložené v Roadbook NAVI přes „📥 Uložit do telefonu“ vidí Android Auto taky.

Nové APK je potřeba sestavit jen při změně **Android části** (Android Auto, ikona, název).

## 1. Otevření projektu

1. Celou složku `android-app` zkopíruj na disk (nebo nahraď tu z verze 1 – **starou
   složku `app` smaž**, ať tam nezůstanou staré soubory).
2. Android Studio → **File → Open** → složka `android-app` → Trust Project.
3. Gradle JDK nech na Javě **17 nebo 21** (ne 25 – viz minule).
4. Počkej na Gradle sync. Kdyby skončil chybou, pošli text chyby z okna **Build**.

Nastavení je v `gradle.properties` (adresa webu, doména, server, verze).

## 2. Sestavení a instalace

- Rychle na zkoušku: zelená šipka ▶ (s telefonem připojeným přes USB a zapnutým laděním USB),
  nebo APK z `app/build/outputs/apk/debug/`.
- Podepsané APK: **Build → Generate Signed App Bundle or APK… → APK** (klíč `.jks` si schovej).
- Verze 2 se instaluje přes verzi 1 (stejný balíček `cz.cenduroff.app`). Kdyby Android hlásil
  konflikt podpisu, starou aplikaci odinstaluj.
- Při prvním spuštění povol **polohu** (potřebuje ji i Android Auto).

## 3. Zapnutí v Android Auto (jednou)

Aplikace není z Google Play, proto ji Android Auto ukáže až ve vývojářském režimu:

1. V telefonu otevři nastavení **Android Auto** (Nastavení → Připojená zařízení →
   Předvolby připojení → Android Auto, nebo hledej „Android Auto“).
2. Úplně dole **10× klepni na „Verze“** → potvrď zapnutí vývojářského režimu.
3. Vpravo nahoře **⋮ → Nastavení pro vývojáře** → zaškrtni **Neznámé zdroje**.
4. Připoj telefon k motorce / autu. Ikona **CendurOFF** se objeví mezi aplikacemi
   (případně ji přidej v Android Auto → Přizpůsobit spouštěč).

## 4. Vyzkoušení na počítači (bez motorky)

1. Android Studio → **Tools → SDK Manager → SDK Tools** → zaškrtni
   **Android Auto Desktop Head Unit Emulator** → OK.
2. V telefonu: Android Auto → **⋮ → Spustit server hlavní jednotky** (Start head unit server).
3. Telefon připojený přes USB, v terminálu Android Studia:
   ```
   adb forward tcp:5277 tcp:5277
   ```
4. Spusť `desktop-head-unit.exe` ze složky
   `…\Android\Sdk\extras\google\auto\` – otevře se okno „displeje auta“.

## 5. Ovládání v Android Auto

- **Úvod:** dvě dlaždice – **Navigace ROADBOOK** a **Navigace ATLAS**. Tlačítko **Konec** (roadbook)
  i ikona dlaždic (Atlas) vrací sem.
- **Atlas:** základní mapa OSM natočená ve směru jízdy a mírně nakloněná, trasy tučně v barvách typu.
  Volná jízda se sama chytí nejbližší trasy (modře); má-li roadbook a jedeš po směru, vpravo nahoře
  je šipka další instrukce s odpočtem. Klepnutím na trasu (nebo **Trasy**) vybereš konkrétní trasu –
  nahoře „Trasa: …“. **Volná jízda** se zapne v seznamu Trasy. **− / +** (nebo prsty) = přiblížení.
  Mapa bez signálu ukáže jen dlaždice, které už jsou v telefonu.


- Seznam: READY roadbooky nahoře, „v telefonu“ = uložený pro offline, tlačítko **Obnovit**.
- Jízda: **−** / **+** = korekce počítadla o 50 m, **Konec** = zpět na seznam.
- Bez polohy se ukáže „Čekám na GPS…“, mimo trasu červené „MIMO TRASU · … m“.

## Co zatím chybí / další kroky

- Záznam jízdy se zhasnutým displejem (GPS na pozadí).
- Mapa v Android Auto (teď je tam jen roadbook).
- Trasy bez roadbooku Android Auto nenabízí – roadbook připrav v Roadbook planneru.
