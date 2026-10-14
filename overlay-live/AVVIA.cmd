@echo off
rem Avvia il server dell'overlay live. Lascia aperta questa finestra durante la diretta.
cd /d "%~dp0"
if not exist node_modules (
  echo Prima installazione...
  call npm install --omit=dev --no-fund --no-audit
)
node server.mjs
pause
