@echo off
echo ====================================
echo  Limpeza de Arquivos Duplicados
echo ====================================
echo.
echo AVISO: Este script vai deletar as pastas e arquivos duplicados.
echo A versao correta esta em mobile/ e web/
echo.
pause

REM Ir para raiz do projeto
cd /d "%~dp0"

echo.
echo [1/5] Deletando pastas duplicadas...
echo - Deletando app/
rmdir /S /Q app 2>nul
echo - Deletando lib/
rmdir /S /Q lib 2>nul
echo - Deletando assets/
rmdir /S /Q assets 2>nul
echo - Deletando components/
rmdir /S /Q components 2>nul

echo [2/5] Deletando node_modules da raiz...
rmdir /S /Q node_modules 2>nul

echo [3/5] Deletando arquivos de configuracao duplicados...
del /Q package.json 2>nul
del /Q package-lock.json 2>nul
del /Q tsconfig.json 2>nul
del /Q app.json 2>nul
del /Q index.ts 2>nul

echo [4/5] Deletando scripts de reorganizacao...
del /Q reorganizar.bat 2>nul
del /Q REORGANIZACAO_SUMARIO.md 2>nul
del /Q README_NEW.md 2>nul

echo [5/5] Limpando artefatos antigos...
rmdir /S /Q django-admin 2>nul
rmdir /S /Q backend 2>nul

echo.
echo ====================================
echo  Limpeza Concluida!
echo ====================================
echo.
echo Estrutura final:
echo   mobile/          - App React Native
echo   web/             - Painel Next.js
echo   docs/            - Documentacao
echo   scripts/         - Scripts utilitarios
echo   supabase/        - Configuracoes DB
echo.
echo Agora voce pode testar:
echo.
echo 1. Mobile App:
echo    cd mobile
echo    npm start
echo.
echo 2. Painel Web:
echo    cd web
echo    npm run dev
echo.

pause
