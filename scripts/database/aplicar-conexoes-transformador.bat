@echo off
echo ========================================
echo Aplicando Migration: Conexoes Transformador
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
