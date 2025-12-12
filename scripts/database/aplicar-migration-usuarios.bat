@echo off
echo ====================================
echo  Aplicar Migration: Usuarios e Equipes
echo ====================================
echo.
echo Esta migration vai criar:
echo - Tabela equipes (CNT, MNT, LV)
echo - Tabela usuarios_app (matricula, nome, equipe)
echo - 18 equipes pre-cadastradas
echo.
pause

REM Navegar para pasta do projeto
cd /d "%~dp0"
cd ..\..

echo.
echo Conectando ao Supabase...
echo.

REM Executar migration
supabase db execute -f supabase/migrations/20250117_criar_equipes_e_usuarios.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo  Migration aplicada com sucesso!
    echo ====================================
    echo.
    echo Proximos passos:
    echo 1. Validar dados no painel web (Next.js)
    echo 2. Criar usuarios via painel usando Supabase Admin API
    echo 3. Testar login no app mobile
    echo.
) else (
    echo.
    echo ====================================
    echo  ERRO ao aplicar migration!
    echo ====================================
    echo.
    echo Verifique:
    echo - Se o Supabase CLI esta instalado
    echo - Se voce esta autenticado (supabase login)
    echo - Se o projeto esta linkado (supabase link)
    echo.
)

pause
