# CendurOFF

Atlas a Plánovač – web pro sdílení offroad GPX tras: přihlášení, mapa s podklady OpenStreetMap, trasy
nahrané uživateli a stránka trasy, kam může vlastník přidat 3 fotky a vybrat hlavní.

Tohle je **skutečný backend** (Node.js + Express + PostgreSQL), ne jen artefakt v
Claude — účty, trasy i fotky se ukládají do databáze a fungují po nasazení na
vlastní doméně.

## Jak to je poskládané

```
server.js        – Express server: přihlašování, API pro trasy a fotky
db/schema.sql     – databázová struktura (spustí se automaticky při startu)
public/           – frontend (statické soubory, servíruje je stejný server)
  index.html
  style.css
  app.js
```

- **Přihlášení**: heslo se hashuje (bcrypt), po přihlášení dostane prohlížeč
  bezpečnou httpOnly cookie s podepsaným tokenem (JWT). Není to tedy jen
  "uložené jméno" jako dřív, ale opravdové ověření na serveru.
- **Trasy**: GPX soubor se rozparsuje přímo v prohlížeči (netřeba nic dalšího
  instalovat), spočítaná trasa (body, délka, převýšení) se pošle na server a
  uloží do PostgreSQL.
- **Fotky**: vlastník trasy nahraje až 3 fotky (max 3 MB/kus), server je uloží
  do databáze a umí označit, která je hlavní.

## Lokální spuštění

1. Nainstaluj závislosti:
   ```
   npm install
   ```
2. Zkopíruj `.env.example` na `.env` a vyplň `DATABASE_URL` (potřebuješ běžící
   PostgreSQL — lokálně třeba přes Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=pass postgres`).
3. Spusť server:
   ```
   npm start
   ```
4. Otevři `http://localhost:3000`.

## Nasazení na Railway

1. Nahraj tenhle projekt do GitHub repozitáře (celou složku, včetně `public/`,
   ale **ne** `node_modules` a `.env` — ty už jsou v `.gitignore`).
2. Na [railway.app](https://railway.app) vytvoř nový projekt → **Deploy from GitHub repo**
   a vyber svůj repozitář.
3. V tom samém projektu klikni na **+ New** → **Database** → **PostgreSQL**.
   Railway automaticky vytvoří proměnnou `DATABASE_URL` a zpřístupní ji tvé
   aplikaci (pokud ne, propoj obě služby v záložce *Variables* přes "Reference").
4. U služby s aplikací nastav v **Variables**:
   - `JWT_SECRET` – vlož libovolný dlouhý náhodný řetězec (jinak se po každém
     restartu serveru všichni odhlásí).
   - `NODE_ENV=production`
   - `DATABASE_URL` se objeví automaticky, pokud jsi v kroku 3 přidal Postgres
     ve stejném projektu.
5. Railway pozná Node.js projekt podle `package.json` a spustí `npm start`.
   Při prvním startu se automaticky vytvoří databázové tabulky
   (`db/schema.sql`) — nic ručně spouštět nemusíš.
6. Po nasazení Railway vygeneruje veřejnou URL (v záložce **Settings → Networking
   → Generate Domain**). Otevři ji — měl by naskočit přihlašovací obrazovka a
   fungovat i pro ostatní lidi, ne jen pro tebe.

## Novinky v této verzi

- **Sbalitelný seznam tras** — začíná pod tlačítky lupy, klikem na hlavičku se sbalí/rozbalí
  (stav se pamatuje v prohlížeči).
- **Živá GPS poloha** — tlačítko 📍 zapne sledování polohy zařízení (potřebuje HTTPS, což
  Railway poskytuje automaticky) a modrou tečku na mapě, druhé kliknutí přepne "sledování mě"
  (mapa se drží tvé polohy uprostřed, ale nemění zoom).
- **Kompas** — tlačítko 🧭 (aktivní až po zapnutí GPS) přepíná mezi "sever nahoru" a "směr jízdy
  nahoru". Otočení mapy je řešené vizuálně (CSS transformací), takže při zapnutém režimu "směr
  jízdy nahoru" je ruční tažení a přibližování gesty dočasně vypnuté — přibližovat jde pořád
  tlačítky +/−. Pro přesné klikání na trasy se přepni zpět na "sever nahoru".
- **Výškový profil** v detailu trasy (pokud to GPX obsahuje).
- **Mazání** — vlastník trasy může smazat jednotlivé fotky i celou trasu.
- **Logo a "O projektu"** — v hlavičce a jako modální okno s info o Petrol Machine Silesia.
- **Fonty** — Roboto (text) + Exo 2 (nadpisy).

Endpointy navíc: `DELETE /api/routes/:id` (smaže trasu, fotky se smažou automaticky) a
`DELETE /api/routes/:id/photos/:photoId` (smaže jednu fotku).

## Novinky ve verzi 1.46

- **Jízdní režim Atlasu** (mobil na výšku a nízké displeje na šířku, např. Samsung A13 na motorce):
  tlačítka ve dvou sloupcích u okrajů, uprostřed volný pruh pro trasu. Nahoře vlevo celá obrazovka,
  mapa, benzínky; nahoře vpravo ☰ a záznam; dole (pro palec) sever/směr jízdy, sledovat polohu, + a −.
  Hlavička je schovaná za ☰, seznam tras se otevírá tlačítkem „Trasy“ v hlavičce.
- **Šipka při sledování níž:** na výšku 80 % výšky mapy, na šířku 75 % (dřív 67 %).
- **Sbalitelný panel záznamu:** v jízdním režimu jako malá lišta s časem a km, ťuknutím se rozbalí
  na Pauza / Stop (sbalit jde i na PC šipkou ▾).
- **Celá obrazovka:** podpora starších prohlížečů (Samsung Internet, starší Chrome); kde to nejde
  (iPhone), ukáže se návod „Přidat na plochu“.
- **Aplikace z plochy:** `manifest.webmanifest` + ikony – CendurOFF přidaný na plochu se otevírá bez
  adresního řádku přes celý displej (Android i iPhone), s ohledem na výřez displeje.
- Plovoucí tlačítka nad mapou se přepočítají při každé změně výšky hlavičky; dlouhé jméno
  uživatele (e-mail) se v hlavičce zkrátí.

## Novinky ve verzi 1.45

- **Přihlašování přepsané na token:** po přihlášení server vrátí podepsaný přihlašovací token,
  web si ho uloží v prohlížeči a posílá ho s každým požadavkem v hlavičce `Authorization: Bearer …`.
  Přihlášení tak funguje na všech stránkách (Atlas, Plánovač, Merch) i v prohlížečích, které blokují
  cookies cizích domén (anonymní okno, Safari na iPhonu). Cookie zůstává jako záloha.
  Odhlášení token smaže. **Vyžaduje nasadit nový `server.js` na Railway.**

## Novinky ve verzi 1.44

- Prázdná nebo chybějící adresa backendu v `config.js` (třeba stará verze z mezipaměti) se teď vždy
  nahradí adresou Railway, takže přihlášení nemůže skončit na „Něco se pokazilo“.

## Novinky ve verzi 1.43

- Pojistka proti nekonečnému přeskakování mezi Plánovačem a přihlášením v Atlasu (blikání obrazovky):
  po druhém opakování během 20 s Plánovač přestane přesměrovávat a ukáže hlášku.

## Novinky ve verzi 1.42

- **Návrat k přímé adrese Railway** v `public/config.js` – přeposílání přes `vercel.json` z v1.41 na
  hostingu webu nefungovalo (přihlášení hlásilo chybu). `vercel.json` je odstraněný.
- Odpověď serveru, která není JSON, se teď hlásí jako chyba (dřív mohla rozbít stránku).

## Novinky ve verzi 1.41

- **Oprava přihlášení v anonymním okně a v Safari:** prohlížeče blokují cookies cizích domén, takže
  přihlašovací cookie z Railway se neuložila a po přechodu na jinou stránku byl uživatel odhlášený.
  API teď jde přes stejnou adresu jako web – nový soubor **`vercel.json`** přeposílá `/api/*` na Railway
  a v `public/config.js` je `CENDUROFF_API_URL = ''`. (Kdyby web neběžel na Vercelu, vrať tam plnou
  adresu Railway.)
- Po přihlášení přes „Přihlásit se“ na Merchi se uživatel vrátí zpět na Merch.
- Soubory CSS/JS se načítají s `?v=1.41`, aby prohlížeče po nahrání nové verze nedržely staré.
- Nadpis na Merchi: „Připravujeme Merch.“

## Novinky ve verzi 1.40

- **Jednotná hlavička na všech stránkách** (`public/header.js`): logo s názvem stránky, menu
  **Atlas · Plánovač · Merch** (vždy stejné pořadí a názvy, bez ikonek; aktivní stránka má zlatý
  obrys), „O projektu“ a tlačítko uživatele. Tlačítko uživatele otevře „Můj účet“ se změnou hesla
  a **odhlášením**. „+ Nahrát trasu“ je jen v Atlasu. Nepřihlášený na stránce Merch vidí „Přihlásit se“.
- Okna „O projektu“ a „Můj účet“ jsou teď v `header.js` (z `index.html` zmizela).

## Novinky ve verzi 1.39

- **Plánovač jen pro přihlášené:** nepřihlášeného uživatele Plánovač pošle na přihlášení v Atlasu
  (`index.html?next=planovac.html`) a po přihlášení ho vrátí zpátky (i s otevřenou trasou z odkazu).
  Merch zůstává veřejný.

## Novinky ve verzi 1.38

- **Nová stránka Merch** (`merch.html`) – veřejná (bez přihlášení): mikina Gold & Silver, trička
  Roleplay, trička CendurOFF, Night Ride Edition a samolepka. Ceny zatím „Připravujeme“, objednávky
  e-mailem (tlačítka otevřou e-mail s předvyplněným předmětem), zakázková výroba do 10 dní.
  Styly v `public/merch.css`, fotky v `public/img/merch/`.
- Odkaz na Merch v hlavičce Atlasu i Plánovače, na přihlašovací stránce a v okně „O projektu“.

## Novinky ve verzi 1.37

- Okno „O projektu“: poslední řádek teď zve k podpoře projektu nákupem merche nebo samolepek.

## Novinky ve verzi 1.36

- Trasy se v Atlasu (seznam vlevo) i v Plánovači (výběr trasy) řadí abecedně podle názvu
  podle české abecedy (Č po C, Ch po H, „trasa 2“ před „trasa 10“).

## Novinky ve verzi 1.35

- Logo v okně „O projektu“ ještě o 20 % větší (154 → 185 px).
- Pozor: logo přihlašovací stránky musí ležet v `public/img/cenduroff-logo.png` (ne přímo v `public/`).

## Novinky ve verzi 1.34

- Logo v okně „O projektu“ je o 40 % větší (110 → 154 px).

## Novinky ve verzi 1.33

- **Logo CendurOFF na přihlašovací stránce** – velké (až 320 px) nad nadpisem v levé tmavé části,
  na nízkých oknech se úměrně zmenší; na mobilu menší nad přihlašovacím formulářem.
  Nový soubor `public/img/cenduroff-logo.png`.

## Novinky ve verzi 1.32

- **Zvýraznění trasy ze seznamu:** najetí myší na trasu v seznamu vlevo ji na mapě zvýrazní
  světle modře (stejně jako najetí přímo na čáru) a vytáhne ji nad ostatní trasy.
  (Verze 1.31 s mapou Tracestrack se nenasazovala.)

## Novinky ve verzi 1.30

- **Oprava Plánovače:** když se dalo „Zpět“ ve chvíli, kdy se úsek ještě počítal, úsek zůstal
  navždy „rozpočítaný“ a Uložit hlásilo „počkej, až se dopočítají úseky“. Opraveno; navíc má
  hledání cesty časový limit 25 s a Uložit případný visící úsek samo přepočítá.

## Novinky ve verzi 1.29

- **Podkladové mapy s vrstevnicemi:** Atlas dřív ve skutečnosti používal základní OpenStreetMap
  (bez vrstevnic, jen popisek uváděl CyclOSM). Tlačítko 🗺 (místo dřívějšího 🛰) teď nabízí:
  **CyclOSM** (vrstevnice, stínování terénu, povrchy cest – výchozí), **Turistickou** (OpenTopoMap,
  výrazné vrstevnice), **Základní** a **Satelit**.
- **Atlas a Plánovač mají společnou volbu mapy** – co vybereš na jedné stránce, je i na druhé.

## Novinky ve verzi 1.28

- **Názvy stránek:** hlavní stránka s mapou a navigací je **Atlas** (`index.html`), nová stránka je
  **Plánovač** (`planovac.html`); název je u loga v hlavičce.
- **Plánovač upravuje jen vlastní trasy:** v Plánovači jde otevřít k úpravě jen trasa, kterou
  uživatel sám nahrál (tlačítko „Upravit v plánovači“ se u cizích tras v Atlasu vůbec neukáže).
  Vytvářet nové trasy může každý. Server cizí úpravy odmítne i tak.
- **Role admin:** nový sloupec `users.role` (`'user'` / `'admin'`) – přidá se sám při startu
  serveru, všechny dosavadní účty dostanou `'user'`. Admin může upravovat a mazat trasy, fotky
  a GPX všech uživatelů (v Atlasu i v Plánovači) a mazat cizí recenze. Role se čte z databáze při
  každém požadavku, takže změna platí hned (bez nového přihlášení).
- **Benzínky v Atlasu:** ikonky čerpacích stanic z OpenStreetMap (přes Overpass API) od přiblížení
  ~10, klik ukáže název, značku a otevírací dobu. Zapíná/vypíná je tlačítko ⛽ vedle satelitu,
  stažená data se pamatují v prohlížeči na týden. Při režimu „směr jízdy“ zůstávají ikonky rovně.

### Jak nastavit admina

V Railway → Postgres → záložka **Query/Console**:
```sql
UPDATE users SET role = 'admin' WHERE username = 'tvoje_jmeno';
```
(username je přihlašovací jméno malými písmeny). Odebrání: `UPDATE users SET role = 'user' WHERE username = '...';`
Kdo je admin, uvidí u svého jména v hlavičce „· admin“.

## Novinky ve verzi 1.27

- **Záznam jízdy** (hlavní stránka) — tlačítko „Záznam jízdy“ u ovládání mapy. Nahrává polohu z GPS,
  stopa se kreslí fialově a všechny ostatní trasy zůstávají na mapě, takže jde zároveň jet podle
  některé z nich. Pauza / Pokračovat / Stop, čas, km a rychlost v panelu nahoře (na mobilu dole).
  Body se průběžně ukládají v telefonu (localStorage) — po obnovení stránky nebo pádu prohlížeče
  se záznam obnoví jako pozastavený. Po Stop jde jízdu **uložit do CendurOFF**, stáhnout jako GPX
  (i s časy) nebo poslat do plánovače k úpravě.
  Omezení webu: se zhasnutým displejem / v jiné aplikaci prohlížeč polohu nedostává, proto stránka
  drží displej zapnutý (Wake Lock).
- **Plánovač tras** (`planovac.html`, tlačítko „✏️ Plánovač“ v hlavičce) — samostatná stránka:
  - režim **Po cestách** vede trasu přes [BRouter](https://brouter.de) (zdarma, data OpenStreetMap)
    s vlastním profilem pro endura: preferuje lesní a polní cesty, volitelně i pěšiny; preference
    Terén / Mix / Spíš silnice,
  - režim **Rovně** kreslí úsek přímou čarou nezávisle na mapě; oba režimy jde v trase střídat,
  - body se dají táhnout, klik na čáru vloží nový bod, klik na bod ho smaže nebo přepne úsek,
    Zpět/Znovu (Ctrl+Z / Ctrl+Y), otočení směru,
  - **úprava existujících tras**: otevře trasu z CendurOFF (tlačítko v detailu trasy nebo výběr
    v plánovači) nebo libovolné GPX; vlastník může uložit změny (přepíše trasu), ostatní uloží
    upravenou trasu jako novou,
  - podkladové mapy: základní, turistická (OpenTopoMap), cesty a povrchy (CyclOSM), satelit,
  - rozpracovaná trasa se pamatuje v prohlížeči.
- **public/config.js** — adresa backendu je teď na jednom místě pro obě stránky.

Backend (server.js) se v této verzi **neměnil** — plánovač i záznam používají stávající
`POST /api/routes` a `PATCH /api/routes/:id`. Na web stačí nahrát nové/změněné soubory:
`index.html`, `planovac.html`, `public/app.js`, `public/style.css`, `public/config.js`,
`public/planner.js`, `public/planner.css`, `public/planner-profile.js`.

## Novinky ve verzi 1.17

- **Prohlížeč fotek** — klik na náhled fotky v detailu trasy ji zvětší přes celou obrazovku.
  Listuje se šipkami po stranách, klávesami ← → nebo na mobilu tažením prstu; zavírá se
  křížkem, klávesou Esc nebo klikem mimo fotku.
- **Datum aktualizace GPX** — po nahrazení GPX souboru se v detailu trasy vedle data přidání
  ukazuje i „GPX aktualizováno". Nový sloupec `routes.gpx_updated_at` se přidá sám při startu.

## Novinky ve verzi 1.16

- **Hodnocení tras** — v detailu trasy 1–5 hvězdiček. Každý přihlášený uživatel má na trasu
  jedno hodnocení, dalším klikem ho změní, klikem na stejnou hvězdičku ho zruší. Průměr se
  ukazuje v detailu, v seznamu tras i v bublině na mapě. Nová tabulka `ratings` se vytvoří
  sama při startu serveru.
- **Výběr více tras** — „Stáhnout více tras" v panelu Trasy; klikáním na mapě nebo v seznamu se
  trasy označují a dají se najednou stáhnout jako jeden GPX soubor (každá trasa je
  v něm samostatná stopa).

Endpointy navíc: `PUT /api/routes/:id/rating` (tělo `{ "stars": 1-5 }`) a
`DELETE /api/routes/:id/rating`.

## Registrace se schválením administrátorem

Implementováno přes sloupec `is_approved` v tabulce `users`:

- **Úplně první účet, který se kdy zaregistruje**, se schválí automaticky — to je v praxi ten
  tvůj/majitele projektu, aby nevznikla patová situace "nikdo není schválený, tak nikdo nemůže
  nikoho schválit".
- **Každý další nový účet** po registraci vidí hlášku "čeká na schválení" a nemůže se přihlásit,
  dokud mu `is_approved` nenastavíš na `true`.
- **Stávající účty, které se zaregistrovaly předtím, než jsi tuhle verzi nasadil/a**, se při
  prvním startu nové verze automaticky označí jako schválené — tahle změna tedy nikoho, kdo se
  už dřív zaregistroval, neodhlásí ani nezablokuje.

### Jak schválit nový účet

1. V Railway otevři svou **Postgres** službu → záložka **Data** (u novějších verzí Railway se
   může jmenovat i "Query" nebo mít ikonu tabulky).
2. Najdi tabulku **users** a v ní řádek s uživatelem, kterého chceš pustit dovnitř.
3. U sloupce `is_approved` přepni hodnotu z `false` na `true` a ulož.
4. Uživatel se od té chvíle může normálně přihlásit (nemusí se nic restartovat).

Pokud v UI Railway needitovatelnou tabulku nenajdeš, stejnou věc uděláš i přes záložku
**Query/Console** jednoduchým příkazem:
```sql
UPDATE users SET is_approved = true WHERE username = 'jmeno_uzivatele';
```

## Známá omezení / co dál

- Fotky se ukládají jako base64 přímo v databázi. Pro pár tras je to v pohodě,
  ale pokud jich bude hodně, je lepší časem přejít na objektové úložiště
  (S3, Cloudflare R2, Cloudinary…) a v databázi držet jen odkaz.
- Přihlašovací token má platnost 30 dní; delší/kratší platnost změníš v
  `server.js` (`expiresIn`).
- GPX se čte jen ze značek `<trkpt>` / `<rtept>` s `<ele>` pro výšku — pokud
  by nějaký exportér používal jinou strukturu, dej vědět a doladíme parser.
