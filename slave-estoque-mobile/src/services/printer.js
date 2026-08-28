import * as Print from 'expo-print';
import QRCode from 'qrcode';

export const imprimirComprovante = async (requisicao, equipamentos, formato = '80mm', acao = 'SEPARACAO') => {
  const agora = new Date();
  const dataFormatada = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}`;
  
  // Define a largura baseada no formato escolhido
  let width = '100%';
  if (formato === '58mm') width = '58mm';
  else if (formato === '80mm') width = '80mm';
  
  // HTML do cupom
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Comprovante</title>
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          margin: 0;
          padding: 10px;
          color: #000;
          font-size: ${formato === 'A4' ? '14px' : '12px'};
          width: ${width};
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .title {
          font-size: ${formato === 'A4' ? '20px' : '16px'};
          font-weight: bold;
          margin: 0 0 5px 0;
        }
        .subtitle {
          font-size: ${formato === 'A4' ? '16px' : '12px'};
          margin: 0;
        }
        .info-section {
          margin-bottom: 20px;
        }
        .info-row {
          margin-bottom: 5px;
        }
        .info-label {
          font-weight: bold;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .table th {
          text-align: left;
          border-bottom: 1px dashed #000;
          padding-bottom: 5px;
        }
        .table td {
          padding: 5px 0;
        }
        .signature-section {
          margin-top: 50px;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #000;
          width: 80%;
          margin: 0 auto 10px auto;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">FAP ESTOQUE</h1>
        <p class="subtitle">COMPROVANTE DE ${acao === 'SEPARACAO' ? 'ENTREGA' : 'DEVOLUCAO'}</p>
      </div>

      <div class="info-section">
        <div class="info-row"><span class="info-label">Requisitante:</span> ${requisicao.solicitanteNome || 'N/A'}</div>
        <div class="info-row"><span class="info-label">Depto:</span> ${requisicao.departamento || 'N/A'}</div>
        <div class="info-row"><span class="info-label">Data:</span> ${dataFormatada}</div>
        <div class="info-row"><span class="info-label">Ticket ID:</span> ${(requisicao.id || '').substring(0,8)}</div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Patrimônio</th>
            <th>Equipamento</th>
          </tr>
        </thead>
        <tbody>
          ${(equipamentos || []).map(eq => `
            <tr>
              <td>${eq.codigoPatrimonio || 'N/A'}</td>
              <td>${eq.nome || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="signature-section">
        <div class="signature-line"></div>
        <div>Assinatura do Requisitante</div>
      </div>

      <div class="footer">
        <p>Impresso via FAP Estoque Mobile</p>
      </div>
    </body>
    </html>
  `;

  try {
    await Print.printAsync({
      html: htmlContent,
      width: formato === 'A4' ? undefined : (formato === '80mm' ? 302 : 219)
    });
    return true;
  } catch (error) {
    console.error('Erro na impressão', error);
    return false;
  }
};

export const imprimirEtiqueta = async (equipamento, formato = '58mm') => {
  let width = '58mm';
  let qrSize = 140;
  if (formato === 'A4') {
    width = '100%';
    qrSize = 200;
  } else if (formato === '80mm') {
    width = '80mm';
    qrSize = 180;
  }
  
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(equipamento.codigoPatrimonio || 'PATR-0000', {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: qrSize * 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (e) {
    console.error('Erro ao gerar QR Code para impressão:', e);
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Etiqueta QR Code</title>
      <style>
        @page {
          margin: 0;
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          text-align: center; 
          margin: 0 auto; 
          padding: 8px 6px; 
          width: ${width}; 
          box-sizing: border-box;
          color: #000000;
        }
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .title { 
          font-weight: 800; 
          font-size: ${formato === '80mm' ? '15px' : '13px'}; 
          line-height: 1.2;
          margin-bottom: 6px;
          word-break: break-word;
          max-width: 100%;
        }
        .qr-wrapper {
          margin: 4px auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .qr-img {
          width: ${qrSize}px;
          height: ${qrSize}px;
          display: block;
        }
        .patrimonio { 
          font-size: ${formato === '80mm' ? '14px' : '12px'}; 
          font-weight: 900;
          letter-spacing: 0.5px;
          margin-top: 6px;
          padding: 2px 6px;
          border: 1px dashed #000;
          border-radius: 4px;
        }
        .footer {
          font-size: 8px;
          color: #555;
          margin-top: 4px;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="title">${equipamento.nome || 'Equipamento'}</div>
        <div class="qr-wrapper">
          ${qrCodeDataUrl ? `<img class="qr-img" src="${qrCodeDataUrl}" alt="QR Code" />` : `<div style="font-size:11px;">[QR CODE INDISPONÍVEL]</div>`}
        </div>
        <div class="patrimonio">${equipamento.codigoPatrimonio || 'SEM PATRIMÔNIO'}</div>
        <div class="footer">FAP ESTOQUE</div>
      </div>
    </body>
    </html>
  `;

  try {
    await Print.printAsync({
      html: htmlContent,
      width: formato === 'A4' ? undefined : (formato === '80mm' ? 302 : 219)
    });
    return true;
  } catch (error) {
    console.error('Erro na impressão da etiqueta', error);
    return false;
  }
};
