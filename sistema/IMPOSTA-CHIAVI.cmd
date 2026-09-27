@echo off
rem Doppio clic: chiede le chiavi una alla volta e le salva nel file .env (che non va mai su GitHub).
cd /d "%~dp0.."
node scripts\imposta-chiavi.mts
echo.
pause
