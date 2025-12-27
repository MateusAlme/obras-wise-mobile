@echo off
echo ========================================
echo Aplicando migração: Status da Obra
echo ========================================
echo.

cd /d "C:\Users\Mateus Almeida\obras-wise-mobile"

echo Aplicando migration 20250227_adicionar_status_obra.sql...
supabase db push

echo.
echo ========================================
echo Migração aplicada com sucesso!
echo ========================================
echo.
echo O campo 'status' foi adicionado à tabela obras.
echo Valores possíveis: 'concluida' ou 'parcial'
echo Padrão: 'parcial'
echo.
pause
