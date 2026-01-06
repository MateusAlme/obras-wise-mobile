@echo off
echo ========================================
echo  APLICANDO CAMPO STATUS NA TABELA OBRAS
echo ========================================
echo.
echo Este script vai:
echo - Adicionar campo 'status' na tabela obras
echo - Atualizar status de obras existentes
echo - Criar trigger para sincronizar automaticamente
echo.
pause

cd /d "%~dp0..\.."

echo.
echo Aplicando migration...
supabase db push

echo.
echo ========================================
echo  MIGRATION APLICADA COM SUCESSO!
echo ========================================
echo.
echo Verifique o resultado no Supabase Dashboard.
echo.
pause
