# CendurOFF

Web pro sdílení offroad GPX tras: přihlášení, mapa s podklady OpenStreetMap, trasy
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
