@echo off
echo ========================================
echo Aplicando migração: Unificar Materiais
echo ========================================
echo.
echo Esta migração vai:
echo - Mesclar doc_materiais_realizado em doc_materiais_previsto
echo - Limpar a coluna doc_materiais_realizado
echo.
echo Pressione qualquer tecla para continuar ou Ctrl+C para cancelar...
pause > nul

cd /d "%~dp0..\..\mobile"

echo.
echo Aplicando migração via Supabase CLI...
supabase db push

echo.
echo ========================================
echo Migração concluída!
echo ========================================
echo.
echo Próximos passos:
echo 1. Verificar no dashboard se os dados foram migrados corretamente
echo 2. Testar o app mobile com a nova versão
echo 3. Fazer backup antes de remover a coluna doc_materiais_realizado (futuramente)
echo.
pause
