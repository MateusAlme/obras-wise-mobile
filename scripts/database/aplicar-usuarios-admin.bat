@echo off
echo ========================================
echo Aplicando Migration: Usuarios Admin
echo ========================================
echo.

cd "c:\Users\Mateus Almeida\obras-wise-mobile"

echo Aplicando migration...
supabase db execute -f "supabase/migrations/20250229_funcoes_gerenciar_usuarios_admin.sql"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Migration aplicada com sucesso!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo ERRO ao aplicar migration!
    echo ========================================
)

pause
