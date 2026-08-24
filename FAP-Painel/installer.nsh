!macro customInstall
  DetailPrint "Configurando regras de Firewall do Windows para FAP..."
  nsExec::Exec 'netsh advfirewall firewall add rule name="FAP Painel Server API" dir=in action=allow protocol=TCP localport=3333 profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="FAP Painel Server Frontend" dir=in action=allow protocol=TCP localport=3000 profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="FAP Painel Server App" dir=in action=allow program="$INSTDIR\Painel FAP.exe" enable=yes profile=any'
!macroend

!macro customUnInstall
  DetailPrint "Removendo regras de Firewall do Windows..."
  nsExec::Exec 'netsh advfirewall firewall delete rule name="FAP Painel Server API"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="FAP Painel Server Frontend"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="FAP Painel Server App"'
!macroend
