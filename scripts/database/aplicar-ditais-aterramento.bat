@echo off
echo ============================================================
echo APLICAR MIGRACAO - DITAIS E BOOK ATERRAMENTO
echo ============================================================
echo.

cd /d "%~dp0..\.."

echo Executando migration SQL diretamente no Supabase...
supabase db execute -f supabase/migrations/20250117_add_ditais_e_aterramento.sql

pause
