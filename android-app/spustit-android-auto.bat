@echo off
chcp 65001 >nul
title CendurOFF - Android Auto emulator
rem Spusti emulator displeje Android Auto (Desktop Head Unit).
rem Pred spustenim: telefon pripojeny kabelem, odemceny,
rem v Android Auto -> ⋮ -> "Spustit server hlavni jednotky".

set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "ADB=%SDK%\platform-tools\adb.exe"
set "DHU=%SDK%\extras\google\auto\desktop-head-unit.exe"

if not exist "%ADB%" (
  echo Nenasel jsem adb: "%ADB%"
  echo Zkontroluj cestu k Android SDK v Android Studiu: File - Settings - Android SDK.
  pause & exit /b 1
)
if not exist "%DHU%" (
  echo Nenasel jsem emulator: "%DHU%"
  echo Stahni ho v Android Studiu: Tools - SDK Manager - SDK Tools -
  echo Android Auto Desktop Head Unit Emulator.
  pause & exit /b 1
)

echo Hledam telefon...
"%ADB%" start-server >nul 2>&1
"%ADB%" get-state >nul 2>&1
if errorlevel 1 (
  echo.
  echo Telefon neni pripojeny nebo neni povolene ladeni USB.
  echo - pripoj telefon kabelem a odemkni ho
  echo - na telefonu potvrd "Povolit ladeni USB"
  echo.
  pause & exit /b 1
)

"%ADB%" forward tcp:5277 tcp:5277
if errorlevel 1 (
  echo Nepodarilo se nastavit spojeni s telefonem.
  pause & exit /b 1
)

echo Spoustim Android Auto...
echo (Kdyby to hned spadlo: v telefonu Android Auto - ⋮ - Spustit server hlavni jednotky, a spust znovu.)
cd /d "%SDK%\extras\google\auto"
"%DHU%"
echo.
echo Emulator skoncil.
pause
