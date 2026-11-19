# CendurOFF

Web a aplikace pro sdílení offroad GPX tras: **Atlas** (mapa, navigace, záznam jízdy Stopař, jízda podle roadbooku),
**GPX planner** (plánování tras), **Roadbook editor**, profil jezdce s odznaky a administrace.
Provozuje skupina Petrol Machine Silesia.

Starší historie změn je v [CHANGELOG.md](CHANGELOG.md).

## Jak to běží

| Část | Kde |
|---|---|
| Web (statické soubory v kořeni a ve `public/`) | GitHub Pages, doména `cenduroff.cz` (soubor `CNAME`) |
| Backend (`server.js` + `*-api.js`) | Railway, adresa `api.cenduroff.cz` |
| Databáze | PostgreSQL na Railway (EU West, Amsterdam) |
| Android aplikace | `download/CendurOFF.apk`, verze v `download/app-version.json` |

Web volá backend na adrese z `public/config.js` (`CENDUROFF_API_URL`). Přihlášení drží token v `localStorage`
(hlavička `Authorization: Bearer …`), cookie je záloha.

## Složky a soubory

```
index.html            Atlas (mapa, navigace, Stopař, jízda podle roadbooku)
planovac.html         GPX planner
roadbook-planner.html Roadbook editor
faq.html, merch.html, nastaveni.html, admin.html
roadbook-navi.html    jen přesměrování starých odkazů do Atlasu

public/               frontend: app.js (Atlas), planner.js, rb-*.js (roadbook), gps.js (poloha),
                      roadsnap.js (přichycení na cesty), basemaps.js, header.js (menu), errors.js …
sw.js, manifest.webmanifest   offline režim a instalace na plochu

server.js             Express: přihlášení, trasy, fotky, hodnocení, recenze
security.js           CORS, kontrola fotek, limit pro nepřihlášené
roadbook-api.js       roadbooky
admin-api.js          archiv smazaných tras, projetí, správa uživatelů
profile-api.js        profil jezdce, odznaky, hlášení chyb
backup-api.js         záloha a obnova databáze (jen admin)
osm-api.js, region-api.js, elevation.js   data z OpenStreetMap, benzínky/CHKO, výšky
export-zip.js         ZIP a XLSX pro zálohu

db/schema.sql         referenční kopie struktury (server si tabulky zakládá sám při startu)
tests/                automatické testy (npm test)
download/             APK a číslo jeho verze
```

## Proměnné prostředí (Railway → Variables)

| Proměnná | Význam |
|---|---|
| `DATABASE_URL` | adresa databáze (Railway ji vytvoří s pluginem PostgreSQL) |
| `JWT_SECRET` | **povinné** – dlouhý náhodný text pro podpis přihlášení; bez něj server běží s veřejně známým tajemstvím |
| `CORS_ORIGINS` | další povolené adresy webu, oddělené čárkou (cenduroff.cz, www, GitHub Pages a localhost jsou povolené vždy) |
| `PORT` | nastaví Railway |
| `NODE_ENV=production` | nastavení SSL k databázi |

Vzor je v `.env.example`.

## Spuštění lokálně

```
npm install
cp .env.example .env     # doplň DATABASE_URL (běžící PostgreSQL)
npm start                # http://localhost:3000
npm test                 # testy bezpečnostních funkcí
```

## Vydání nové verze

1. Zvyš číslo verze na všech třech místech: `public/config.js` (`CENDUROFF_WEB_VERSION`), `sw.js` (`VERSION`)
   a `?v=` u všech `<script>` a `<link>` v HTML souborech (telefony pak ukážou „Je dostupná nová verze“).
2. Nové APK ulož jako `download/CendurOFF.apk` a zvyš `download/app-version.json`.
3. Pushni na `main` – GitHub Pages nasadí web, Railway backend.

## Správa

- První registrovaný účet se schválí automaticky, další schvaluje admin v `admin.html`.
- Admina nastavíš v databázi: `UPDATE users SET role = 'admin' WHERE username = 'tvuj@email.cz';`
- Smazané trasy zůstávají v archivu (jen admin je vidí, obnoví nebo smaže natrvalo).
- Záloha a obnova databáze: `admin.html` (ZIP s přehledem v Excelu, GPX, fotkami a daty pro obnovu).

## Bezpečnost (v4.58)

- Server přijímá požadavky jen z povolených adres webu (`security.js`); zápisy z cizích webů odmítne.
- Fotky se kontrolují podle obsahu souboru (JPEG, PNG, WebP, GIF), nic jiného se neuloží.
- Mapová data (OSM, benzínky, CHKO, povrch tras) smí nepřihlášený načíst omezeně (400 požadavků za hodinu
  na adresu), pak se mu ukáže přihlášení. Přihlášený člen limit nemá.
- Chyby z webu a telefonů se hlásí do administrace (`admin.html` → „Chyby z telefonů“).
