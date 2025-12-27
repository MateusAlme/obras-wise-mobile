@echo off
echo ========================================
echo Aplicando Migration: Sincronizar data_fechamento
echo ========================================
echo.
echo Esta migration vai:
echo 1. Criar colunas data_abertura e data_fechamento se nao existirem
echo 2. Preencher data_abertura com created_at
echo 3. Sincronizar data_fechamento com finalizada_em para obras finalizadas
echo 4. Criar indices para melhor performance
echo.
echo Pressione qualquer tecla para continuar ou Ctrl+C para cancelar...
pause >nul

cd /d "%~dp0..\.."

echo.
echo Executando migration...
supabase db push --include-all

echo.
echo ========================================
echo Migration aplicada!
echo ========================================
echo.
echo Para verificar o resultado, acesse:
echo https://supabase.com/dashboard/project/xwkprmwpndaipxngjqyv/editor
echo.
echo Ou execute no SQL Editor:
echo.
echo SELECT
echo   COUNT(*) as total_obras,
echo   COUNT(CASE WHEN status = 'finalizada' THEN 1 END) as finalizadas_status,
echo   COUNT(data_fechamento) as com_data_fechamento
echo FROM obras;
echo.
pause
