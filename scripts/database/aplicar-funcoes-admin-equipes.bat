@echo off
echo =====================================
echo Aplicando Funcoes Admin de Equipes
echo =====================================
echo.

cd /d "C:\Users\Mateus Almeida\obras-wise-mobile"

echo Aplicando migration...
supabase db push

echo.
echo =====================================
echo Migration aplicada com sucesso!
echo =====================================
echo.
echo Funcoes criadas:
echo - criar_equipe_com_senha(codigo, senha)
echo - admin_resetar_senha_equipe(codigo, senha_nova)
echo.
pause
