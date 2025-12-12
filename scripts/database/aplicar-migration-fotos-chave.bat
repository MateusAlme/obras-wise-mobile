@echo off
echo ========================================
echo MIGRATION: Adicionar colunas fotos_abertura e fotos_fechamento
echo ========================================
echo.
echo IMPORTANTE: Execute este SQL no Supabase Dashboard
echo.
echo 1. Acesse: https://supabase.com/dashboard
echo 2. Selecione seu projeto
echo 3. Va em "SQL Editor"
echo 4. Cole e execute o SQL abaixo:
echo.
echo ----------------------------------------
type supabase\migrations\20250113_add_fotos_chave.sql
echo ----------------------------------------
echo.
pause
