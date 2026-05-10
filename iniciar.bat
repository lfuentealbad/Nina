@echo off
cd /d "%~dp0"
title Carolina - Servidor local
echo.
echo === Carolina ===
echo.
echo Servidor en http://localhost:8080/
echo Manten esta ventana abierta mientras uses la app.
echo Para detener: cierra esta ventana o aprieta Ctrl+C.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8080/"
python -m http.server 8080
