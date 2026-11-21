Sem nahraj podepsané APK pod názvem s verzí, např. CendurOFF-3.3.apk. Starý soubor smaž, ať repozitář nebobtná.

Pak uprav download/app-version.json:
  {"version":"3.3","apk":"CendurOFF-3.3.apk"}
  - version = nejnovější verze aplikace; aplikace se starší verzí se zablokuje oknem „Je potřeba aktualizovat“ s tlačítkem Stáhnout
  - apk     = název souboru ke stažení (odkazy na webu i v aplikaci si ho berou odtud)
  - min     = (volitelné) nejnižší povolená verze; když chybí, platí version, tedy vždy nejnovější

Pořadí při vydání: nejdřív pushni APK, až potom zvyš verzi v app-version.json (jinak by se lidé zablokovali bez souboru ke stažení).
