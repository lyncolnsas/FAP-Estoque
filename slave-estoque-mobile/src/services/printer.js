import * as Print from 'expo-print';

export const imprimirComprovante = async (requisicao, equipamentos, formato = '80mm', acao = 'SEPARACAO') => {
  const agora = new Date();
  const dataFormatada = `${agora.toLocaleDateString('pt-BR')} as ${agora.toLocaleTimeString('pt-BR')}`;
  
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
        <h1 class="title">SLAVE ESTOQUE</h1>
        <p class="subtitle">COMPROVANTE DE ${acao === 'SEPARACAO' ? 'ENTREGA' : 'DEVOLUCAO'}</p>
      </div>

      <div class="info-section">
        <div class="info-row"><span class="info-label">Requisitante:</span> ${requisicao.solicitanteNome || 'N/A'}</div>
        <div class="info-row"><span class="info-label">Depto:</span> ${requisicao.departamento || 'N/A'}</div>
        <div class="info-row"><span class="info-label">Data:</span> ${dataFormatada}</div>
        <div class="info-row"><span class="info-label">Ticket ID:</span> ${requisicao.id.substring(0,8)}</div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Patrimonio</th>
            <th>Equipamento</th>
          </tr>
        </thead>
        <tbody>
          ${equipamentos.map(eq => `
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
        <p>Impresso via Slave Estoque Mobile</p>
      </div>
    </body>
    </html>
  `;

  try {
    await Print.printAsync({
      html: htmlContent,
      // para térmica e A4 usando Print service do Android, deixar a propria lib formatar
      width: formato === 'A4' ? undefined : (formato === '80mm' ? 302 : 219) // 80mm ~ 302px, 58mm ~ 219px (estimativa 96 dpi)
    });
    return true;
  } catch (error) {
    console.error('Erro na impressão', error);
    return false;
  }
};

export const imprimirEtiqueta = async (equipamento, formato = '58mm') => {
  let width = '58mm';
  if (formato === 'A4') width = '100%';
  if (formato === '80mm') width = '80mm';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Etiqueta</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      <style>
        body { font-family: sans-serif; text-align: center; margin: 0; padding: 10px; width: ${width}; }
        .name { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
        .patrimonio { font-size: 12px; margin-top: 5px; }
        svg { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      <div class="name">${equipamento.nome}</div>
      <svg id="barcode"></svg>
      <div class="patrimonio">${equipamento.codigoPatrimonio}</div>
      <script>
        try {
          JsBarcode("#barcode", "${equipamento.codigoPatrimonio}", {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: false
          });
        } catch(e) {}
      </script>
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
