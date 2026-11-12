// Společné nastavení pro Atlas (index.html), Plánovač (planovac.html) a Merch (merch.html).

// Adresa backendu (Railway) bez lomítka na konci.
// (Pokus z v1.41 s prázdnou adresou a přeposíláním přes vercel.json na tomto hostingu nefunguje.)
window.CENDUROFF_API_URL = 'https://cenduroff-web.up.railway.app';

// Verze webu (zobrazí se v Nastavení účtu). Zvyšuj spolu s VERSION v sw.js.
window.CENDUROFF_WEB_VERSION = '4.5';
