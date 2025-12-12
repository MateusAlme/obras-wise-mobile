@echo off
echo ==========================================
echo Aplicando Politicas RLS para Storage
echo ==========================================
echo.

cd /d "%~dp0\.."

echo Executando SQL no Supabase...
supabase db execute --file "supabase\migrations\20250208_storage_rls_policies.sql"

echo.
echo ==========================================
echo Concluido!
echo ==========================================
pause
