// Společné nastavení pro Atlas (index.html), Plánovač (planovac.html) a Merch (merch.html).

// Adresa backendu pro volání API.
// Prázdný řetězec = API běží na STEJNÉ adrese jako web: Vercel ho podle souboru vercel.json
// přeposílá na Railway (/api/* -> https://cenduroff-web.up.railway.app/api/*).
// Díky tomu je přihlašovací cookie „vlastní“ (first-party) a přihlášení vydrží i v anonymním
// okně a v Safari na iPhonu, které cookies cizích domén blokují.
// Kdyby web neběžel na Vercelu, vrať sem plnou adresu: 'https://cenduroff-web.up.railway.app'
window.CENDUROFF_API_URL = '';
