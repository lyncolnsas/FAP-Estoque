const { app, Tray, Menu, shell, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const express = require('express');
const qrcode = require('qrcode');
const { createProxyMiddleware } = require('http-proxy-middleware');

let tray = null;
let apiProcess = null;
const expressApp = express();

const isPackaged = app.isPackaged;
const basePath = isPackaged ? process.resourcesPath : path.join(__dirname, '..');

// Caminhos corretos baseados em estar empacotado (.exe) ou em dev
const apiPath = isPackaged ? path.join(basePath, 'api') : path.join(__dirname, '../slave-estoque-api');
const pwaPath = isPackaged ? path.join(basePath, 'pwa') : path.join(__dirname, '../slave-estoque-pwa/dist');

// Configura servidor estático do PWA (Porta 3000)
expressApp.use(express.static(pwaPath));

// Servir diretório de uploads localmente
expressApp.use('/uploads', express.static(path.join(app.getPath('userData'), 'uploads')));

// Proxy para a API (Porta 3333)
// Isso resolve todos os problemas de CORS e Firewall em redes locais
expressApp.use(['/api', '/sync', '/upload'], createProxyMiddleware({
  target: 'http://127.0.0.1:3333',
  changeOrigin: true,
  pathRewrite: (p) => {
    if (p.startsWith('/api')) {
      return p.replace(/^\/api/, '');
    }
    return p;
  },
  on: {
    error: (err, req, res) => {
      console.error('Erro no proxy da API:', err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Bad Gateway', message: 'API is starting up ou indisponível.' });
      }
    }
  }
}));

// Rota de fallback para SPA (Single Page Application)
expressApp.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(pwaPath, 'index.html'));
  } else {
    next();
  }
});

const frontendPort = 3000;
const { dialog } = require('electron');

function startFrontend() {
  const server = expressApp.listen(frontendPort, '0.0.0.0', () => {
    console.log(`Frontend servido na porta ${frontendPort}`);
  });
  
  server.on('error', (e) => {
    console.error('Aviso: Frontend não pôde usar a porta (pode já estar rodando):', e.message);
    if (e.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'Erro de Inicialização (Porta em Uso)',
        'O Painel FAP já está em execução (Porta 3000 em uso) ou um processo antigo travou.\n\nPor favor, reinicie o computador ou feche a instância anterior (ícone na barra de tarefas perto do relógio) antes de abrir uma nova.'
      );
      app.quit();
    }
  });
}

function startAPI() {
  if (apiProcess) {
    apiProcess.kill();
  }

  // Mover o banco de dados SQLite para a pasta userData para persistir entre atualizações e evitar erro de permissão
  const userDataPath = app.getPath('userData');
  const dbDestPath = path.join(userDataPath, 'dev.db');
  const dbSrcPath = path.join(apiPath, 'prisma', 'dev.db');
  
  // Copiar DB apenas na primeira vez
  if (!fs.existsSync(dbDestPath)) {
    if (fs.existsSync(dbSrcPath)) {
      fs.copyFileSync(dbSrcPath, dbDestPath);
      console.log('Banco de dados SQLite inicializado em:', dbDestPath);
    }
  }
  
  // Prisma usa formato URI file:C:/...
  const dbUrl = `file:${dbDestPath.replace(/\\/g, '/')}`;

  // A API precisa do caminho base para achar arquivos
  // Usamos o próprio executável do Electron em modo Node para garantir que rode em qualquer PC
  let uploadDir = path.join(userDataPath, 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch(e) {}

  apiProcess = spawn(process.execPath, ['dist/index.js'], {
    cwd: apiPath,
    env: { ...process.env, PORT: '3333', ELECTRON_RUN_AS_NODE: '1', DATABASE_URL: dbUrl, UPLOAD_DIR: uploadDir },
    shell: false
  });
  
  apiProcess.on('error', (err) => {
    console.error('Falha ao iniciar a API:', err);
  });

  apiProcess.stdout.on('data', (data) => console.log(`API: ${data}`));
  apiProcess.stderr.on('data', (data) => {
    console.error(`API Error: ${data}`);
    try {
      fs.appendFileSync(path.join(userDataPath, 'api-error.log'), `[${new Date().toISOString()}] ${data}\n`);
    } catch (e) {}
  });

  apiProcess.on('exit', (code) => {
    console.log(`API process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      const logPath = path.join(userDataPath, 'api-error.log');
      dialog.showErrorBox(
        'Erro Crítico na API (Código ' + code + ')',
        'O serviço interno fechou inesperadamente. Isso geralmente ocorre se a porta 3333 já estiver em uso por uma instância travada, ou devido a um erro no banco de dados.\n\nVerifique o arquivo de log em:\n' + logPath + '\n\nReinicie o computador e tente novamente.'
      );
      app.quit();
    }
  });
}

function checkAndRequestFirewall() {
  const ruleName = 'FAP Painel Server';
  const { exec } = require('child_process');
  
  exec(`netsh advfirewall firewall show rule name="${ruleName} API"`, (err, stdout) => {
    // Verifica se a regra existe E se cobre profile=any (Privado incluso)
    const ruleExists = !err && stdout.includes(ruleName) && stdout.includes('Qualquer');
    
    if (!ruleExists) {
      // Cria um script .bat temporário para evitar problemas de encoding do PowerShell
      const os = require('os');
      const batPath = path.join(os.tmpdir(), 'fap_firewall_setup.bat');
      const exePath = process.execPath;
      
      const batContent = [
        '@echo off',
        // Limpa regras antigas (ignora erros se não existirem)
        `netsh advfirewall firewall delete rule name="${ruleName} API" 2>nul`,
        `netsh advfirewall firewall delete rule name="${ruleName} Frontend" 2>nul`,
        `netsh advfirewall firewall delete rule name="${ruleName} App" 2>nul`,
        `netsh advfirewall firewall delete rule name="${ruleName}" 2>nul`,
        // Cria regras novas com profile=any (cobre Privado, Público e Domínio)
        `netsh advfirewall firewall add rule name="${ruleName} API" dir=in action=allow protocol=TCP localport=3333 profile=any`,
        `netsh advfirewall firewall add rule name="${ruleName} Frontend" dir=in action=allow protocol=TCP localport=3000 profile=any`,
        `netsh advfirewall firewall add rule name="${ruleName} App" dir=in action=allow program="${exePath}" enable=yes profile=any`,
        'exit /b 0'
      ].join('\r\n');
      
      fs.writeFileSync(batPath, batContent, 'utf-8');
      
      // Executa o .bat com elevação UAC
      exec(`powershell.exe -Command "Start-Process cmd.exe -ArgumentList '/c \\"${batPath}\\"' -Verb RunAs -WindowStyle Hidden"`, (error) => {
        if (error) {
          console.error("Falha ao solicitar permissão de firewall:", error);
        } else {
          console.log("Regras de firewall solicitadas ao usuário (profile=any).");
        }
      });
    } else {
      console.log("Regras de firewall já configuradas corretamente.");
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Alguém tentou executar uma segunda instância, focamos a nossa janela principal/painel.
    if (dashboardWindow) {
      if (dashboardWindow.isMinimized()) dashboardWindow.restore();
      dashboardWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Solicitar permissão de firewall para conexões externas via UAC
    checkAndRequestFirewall();

    // Ocultar ícone do dock no macOS (não se aplica tanto no Win, mas boa prática)
    if (app.dock) app.dock.hide();

    // Iniciar servidores
    startFrontend();
    startAPI();

  // Configurar o ícone da bandeja
  const iconPath = path.join(__dirname, 'icone.ico');
  const { nativeImage } = require('electron');
  
  try {
    if (require('fs').existsSync(iconPath)) {
      tray = new Tray(nativeImage.createFromPath(iconPath));
    } else {
      // Cria um ícone de fallback azul simples em base64 se o favicon nao for achado
      const fallbackIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZUlEQVQ4T2NkoBAwUqifYdQABjSjBAZ/I4wMGsAA/0E0OQ4gxjCSZAAjFgyA6wIwjBwHkGQARixugGwgx2EAyGZSGgYwGxkYGMiM42hGkgEwDUQ5gBSXkGIAMYphQPIpA2HwAAAgzBQzQ4N3xwAAAABJRU5ErkJggg==');
      tray = new Tray(fallbackIcon);
    }
  } catch (e) {
    console.error("Erro ao carregar Tray:", e);
  }
  
  if (tray) {
    const os = require('os');
    const nets = os.networkInterfaces();
    let ips = [];
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          ips.push({ name, address: net.address });
        }
      }
    }

    let ipMenu = ips.map(ip => ({
      label: `Conectar via ${ip.name}: http://${ip.address}:${frontendPort}`,
      click: () => { shell.openExternal(`http://${ip.address}:${frontendPort}`); }
    }));

    if (ipMenu.length === 0) {
      ipMenu.push({ label: 'Nenhuma rede conectada', enabled: false });
    }

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Painel FAP - Servidor Ativo', enabled: false },
      { type: 'separator' },
      { label: 'Abrir Painel de Conexão', click: () => { openDashboard(ips, frontendPort); } },
      { label: 'Abrir no Próprio PC', click: () => { shell.openExternal(`http://localhost:${frontendPort}`); } },
      { type: 'separator' },
      { label: 'Reiniciar Servidor (API)', click: () => {
          if (apiProcess) apiProcess.kill();
          startAPI();
      }},
      { label: 'Sair', click: () => {
          if (apiProcess) apiProcess.kill();
          app.quit();
      }}
    ]);
    
    tray.setToolTip('Painel FAP - Sistema de Estoque');
    tray.setContextMenu(contextMenu);
    
    // Abrir o painel automaticamente na inicialização
    openDashboard(ips, frontendPort);
  }
});

let dashboardWindow = null;

async function openDashboard(ips, port) {
  if (dashboardWindow) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 600,
    height: 720,
    title: 'Painel de Conexão FAP',
    icon: path.join(__dirname, 'icone.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  const ipCardsHtml = ips.length === 0 
    ? `<div class="card"><p>Nenhuma rede detectada. Verifique se o Wi-Fi ou Cabo estão conectados.</p></div>`
    : ips.map(ip => `
        <div class="card">
          <h3>Rede: ${ip.name}</h3>
          <p><a href="#" class="link" onclick="openLink('http://${ip.address}:${port}')">http://${ip.address}:${port}</a></p>
          <button class="btn" onclick="copyText('http://${ip.address}:${port}')">Copiar Link</button>
        </div>
      `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Painel de Conexão FAP</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; color: #333; text-align: center; }
        h1 { color: #1a73e8; margin-top: 10px; }
        .card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.08); }
        .qr-box { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 10px 0; }
        .link { font-size: 1.2em; color: #1a73e8; text-decoration: none; word-break: break-all; }
        .btn { display: inline-block; padding: 10px 20px; margin-top: 10px; background-color: #1a73e8; color: white; text-decoration: none; border-radius: 6px; cursor: pointer; border: none; font-size: 14px; font-weight: 500; }
        .btn:hover { background-color: #1557b0; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #1a73e8; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin-bottom: 12px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
      <script>
        const { clipboard, shell } = require('electron');
        const qrcode = require('qrcode');
        const http = require('http');

        function copyText(text) {
          clipboard.writeText(text);
          alert('Link copiado: ' + text);
        }
        function openLink(text) {
          shell.openExternal(text);
        }

        function loadQrCode() {
          const container = document.getElementById('qr-container');
          container.innerHTML = '<div class="spinner"></div><p style="color: #666;">Conectando ao servidor interno...</p>';
          
          let attempts = 0;
          const maxAttempts = 20;

          const tryFetch = () => {
            attempts++;
            const req = http.get('http://127.0.0.1:3333/sync/qr-payload', (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', async () => {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.encryptedPayload) {
                    const qrUrl = await qrcode.toDataURL(parsed.encryptedPayload, { width: 250, margin: 2 });
                    container.innerHTML = '<img src="' + qrUrl + '" alt="QR Code" style="width:250px;height:250px;display:block;margin:auto;" />';
                    return;
                  }
                } catch(e) {}
                scheduleRetry();
              });
            });

            req.on('error', () => {
              scheduleRetry();
            });

            req.setTimeout(2500, () => {
              req.destroy();
              scheduleRetry();
            });
          };

          const scheduleRetry = () => {
            if (attempts < maxAttempts) {
              container.innerHTML = '<div class="spinner"></div><p style="color: #666;">Aguardando inicialização da API... (' + attempts + '/' + maxAttempts + ')</p>';
              setTimeout(tryFetch, 1000);
            } else {
              container.innerHTML = '<p style="color: #dc2626; font-weight: 500;">A API ainda não respondeu.</p><button class="btn" onclick="loadQrCode()">Tentar Novamente</button>';
            }
          };

          tryFetch();
        }

        window.addEventListener('DOMContentLoaded', loadQrCode);
      </script>
    </head>
    <body>
      <h1>Rede FAP Ativa</h1>
      <p>Use os acessos abaixo para conectar celulares ou outros computadores na mesma rede.</p>

      <div class="card">
        <h2>Conexão Mobile (Celular)</h2>
        <div class="qr-box" id="qr-container">
          <div class="spinner"></div>
          <p style="color: #666;">Carregando QR Code...</p>
        </div>
        <p><b>Abra o app FAP Estoque e escaneie o QR Code acima!</b></p>
        <p style="font-size: 12px; color: #666;">(Conexão direta segura via API)</p>
      </div>

      <h2>Acesso pelo Computador (Painel Web)</h2>
      ${ipCardsHtml}
    </body>
    </html>
  `;

  dashboardWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
}

app.on('window-all-closed', () => {
  // Previne fechar o app, continua rodando na bandeja
});

app.on('before-quit', () => {
  if (apiProcess) {
    apiProcess.kill();
  }
});}

