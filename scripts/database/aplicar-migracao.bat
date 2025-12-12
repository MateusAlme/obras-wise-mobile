@echo off
echo ========================================
echo   APLICANDO MIGRACAO - OBRAS TECCEL
echo ========================================
echo.
echo Este script vai executar a migracao SQL
echo diretamente no banco Supabase remoto.
echo.
echo Pressione qualquer tecla para continuar...
pause >nul

cd "%~dp0"

echo.
echo [1/2] Lendo arquivo SQL...
set "SQL_FILE=supabase\migrations\20250112_multiplas_fotos.sql"

if not exist "%SQL_FILE%" (
    echo ERRO: Arquivo %SQL_FILE% nao encontrado!
    pause
    exit /b 1
)

echo OK - Arquivo encontrado
echo.
echo [2/2] Aplicando via Supabase Dashboard...
echo.
echo IMPORTANTE: Copie o SQL e execute manualmente
echo.
echo 1. Abra: https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql/new
echo 2. Copie TODO o conteudo de: %SQL_FILE%
echo 3. Cole no SQL Editor
echo 4. Clique em RUN (ou Ctrl+Enter)
echo.
echo Abrindo arquivo SQL...
start "" notepad "%SQL_FILE%"
echo.
echo Abrindo navegador...
timeout /t 2 >nul
start "" "https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql/new"
echo.
echo ========================================
echo   AGUARDANDO VOCE EXECUTAR NO BROWSER
echo ========================================
echo.
echo Depois de executar o SQL no browser:
echo - Volte ao app
echo - Tente cadastrar uma obra
echo - O erro deve sumir!
echo.
pause
