@echo off
echo ====================================
echo VERIFICAR E APLICAR STATUS DE OBRA
echo ====================================
echo.
echo Este script vai:
echo 1. Verificar se as colunas data_abertura e data_fechamento existem
echo 2. Aplicar a migracao se necessario
echo 3. Atualizar a obra 2222222222 para status "Concluida"
echo.
pause

cd /d "C:\Users\Mateus Almeida\obras-wise-mobile"

echo.
echo [1/3] Aplicando migracao de status...
supabase db push

echo.
echo [2/3] Executando SQL para finalizar a obra 2222222222...
supabase db execute --file supabase\migrations\finalizar_obra_2222222222.sql

echo.
echo [3/3] Verificando status da obra...
supabase db execute --command "SELECT obra, data_abertura, data_fechamento FROM obras WHERE obra = '2222222222';"

echo.
echo ====================================
echo CONCLUIDO!
echo ====================================
echo A obra 2222222222 agora deve aparecer como "Concluida" no sistema web.
echo.
pause
