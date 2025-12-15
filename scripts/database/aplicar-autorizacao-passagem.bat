@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   APLICAR MIGRAÇÃO - AUTORIZAÇÃO DE PASSAGEM
echo ========================================
echo.

set MIGRATION_FILE=supabase\migrations\20250214_adicionar_autorizacao_passagem.sql

echo 📋 Verificando arquivo de migração...
if not exist "%MIGRATION_FILE%" (
    echo ❌ ERRO: Arquivo de migração não encontrado!
    echo    Caminho: %MIGRATION_FILE%
    pause
    exit /b 1
)

echo ✅ Arquivo encontrado: %MIGRATION_FILE%
echo.

echo 🔍 Verificando conexão com Supabase...
supabase status >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Supabase CLI não está instalado ou não está configurado
    echo.
    echo 📝 OPÇÃO ALTERNATIVA: Copiar SQL e colar no Dashboard do Supabase
    echo.
    echo 1. Acesse: https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql
    echo 2. Cole o conteúdo do arquivo: %MIGRATION_FILE%
    echo 3. Clique em "RUN"
    echo.
    pause
    exit /b 0
)

echo.
echo 📤 Aplicando migração no Supabase...
echo.

supabase db push

if %errorlevel% equ 0 (
    echo.
    echo ✅ MIGRAÇÃO APLICADA COM SUCESSO!
    echo.
    echo 🎯 A coluna 'doc_autorizacao_passagem' foi adicionada à tabela 'obras'
    echo.
) else (
    echo.
    echo ❌ ERRO ao aplicar migração
    echo.
    echo 📝 Tente aplicar manualmente:
    echo.
    echo 1. Acesse o Dashboard do Supabase
    echo 2. Vá em SQL Editor
    echo 3. Cole e execute o conteúdo de: %MIGRATION_FILE%
    echo.
)

pause
