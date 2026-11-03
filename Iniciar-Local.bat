@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo No se encontro npm. Instale Node.js y vuelva a intentar.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Faltan las dependencias del proyecto.
  echo Ejecute npm.cmd ci en esta carpeta y vuelva a intentar.
  pause
  exit /b 1
)

echo Iniciando COAT-Informes en http://127.0.0.1:42871
echo Para detener el servidor, presione Ctrl+C en esta ventana.
echo La aplicacion utiliza los servicios configurados en el proyecto.
echo.
call npm.cmd run dev -- --host 127.0.0.1 --port 42871 --strictPort --open
if errorlevel 1 (
  echo.
  echo No se pudo iniciar el servidor. Revise el mensaje anterior.
  echo Si el puerto 42871 esta ocupado, cierre el servidor anterior.
  pause
  exit /b 1
)
endlocal
