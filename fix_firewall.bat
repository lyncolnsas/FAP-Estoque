@echo off
title Liberacao de Firewall - Painel FAP
color 0A

:: Verifica se esta rodando como Administrador
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo [INFO] Solicitando permissao de Administrador...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*:"="
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
echo ========================================================
echo        FAP PAINEL - CONFIGURACAO DE FIREWALL
echo ========================================================
echo.
echo 1. Removendo regras antigas (se houver)...
netsh advfirewall firewall delete rule name="FAP Painel Server API" >nul 2>&1
netsh advfirewall firewall delete rule name="FAP Painel Server Frontend" >nul 2>&1
netsh advfirewall firewall delete rule name="FAP Painel Server App" >nul 2>&1
netsh advfirewall firewall delete rule name="Painel FAP - Porta 3333 API" >nul 2>&1
netsh advfirewall firewall delete rule name="Painel FAP - Porta 3000 Frontend" >nul 2>&1

echo 2. Adicionando regra para Porta 3333 (API e Sincronismo Mobile)...
netsh advfirewall firewall add rule name="FAP Painel Server API" dir=in action=allow protocol=TCP localport=3333 profile=any

echo 3. Adicionando regra para Porta 3000 (Painel Web)...
netsh advfirewall firewall add rule name="FAP Painel Server Frontend" dir=in action=allow protocol=TCP localport=3000 profile=any

echo.
echo ========================================================
echo   SUCESSO! O Firewall do Windows foi liberado para:
echo   - Rede Privada
echo   - Rede Publica (Wi-Fi)
echo   - Rede de Dominio
echo ========================================================
echo.
pause
