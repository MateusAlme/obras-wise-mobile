@echo off
echo ========================================
echo Aplicando Migration: Materiais Documentacao
echo ========================================
echo.

cd ..\..\

echo Aplicando migration no banco de dados remoto...
supabase db push

echo.
echo ========================================
echo Migration aplicada com sucesso!
echo ========================================
pause
