@echo off
echo ==============================================
echo Iniciando o SLAVE ESTOQUE...
echo ==============================================

echo Iniciando o Backend (API + WhatsApp)...
start cmd /k "cd slave-estoque-api && npx ts-node src/index.ts"

echo Iniciando o Frontend (PWA)...
start cmd /k "cd slave-estoque-pwa && npm run dev"

echo Tudo certo! Feche as janelas pretas abertas para desligar os servidores quando terminar.
pause
