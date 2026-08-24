@echo off
echo ========================================================
echo Liberando porta 3333 no Firewall para Slave Estoque API
echo ========================================================

netsh advfirewall firewall add rule name="Slave Estoque API (TCP 3333)" dir=in action=allow protocol=TCP localport=3333

if %errorlevel% == 0 (
    echo.
    echo [SUCESSO] Porta 3333 liberada com sucesso!
) else (
    echo.
    echo [ERRO] Acesso Negado! Voce precisa de privilegios de Administrador.
    echo Feche esta janela, clique com o BOTAO DIREITO no arquivo e
    echo selecione "Executar como Administrador".
)

echo.
pause
