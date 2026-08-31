import { prisma } from './prisma';
import { whatsapp } from './whatsapp';
import { sendEmail } from './email';

/**
 * Formata um número de telefone para o padrão JID do WhatsApp (ex: 5511999999999@s.whatsapp.net).
 */
export function formatWhatsappJid(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;

  // Se o número tiver 10 ou 11 dígitos (DDD + número), adiciona o DDI do Brasil (55)
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  return `${digits}@s.whatsapp.net`;
}

/**
 * Notifica o solicitante quando os aparelhos são ENTREGUES / RECEBIDOS para uso.
 */
export async function notificarEntregaEquipamentos(requisicaoId: string): Promise<boolean> {
  try {
    const req = await prisma.requisicao.findUnique({
      where: { id: requisicaoId },
      include: {
        itens: {
          include: {
            equipamento: true
          }
        }
      }
    });

    if (!req || !req.solicitanteWhatsapp) return false;

    const jid = formatWhatsappJid(req.solicitanteWhatsapp);
    if (!jid) return false;

    const itensSeparados = req.itens.filter(i => i.statusSeparacao);
    const listaItens = (itensSeparados.length > 0 ? itensSeparados : req.itens)
      .map(i => `• *${i.equipamento.nome}* (Patrimônio: *${i.equipamento.codigoPatrimonio}*)`)
      .join('\n');

    const dataFimStr = req.dataFimEvento.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const msg = [
      `📦 *Entrega de Equipamentos Realizada!*`,
      ``,
      `Olá, *${req.solicitanteNome}*!`,
      `Confirmamos que os seguintes equipamentos foram entregues para o seu uso:`,
      ``,
      listaItens,
      ``,
      `📅 *Previsão de Devolução:* ${dataFimStr}`,
      ``,
      `⚠️ *Avisos Importantes:*`,
      `- Por favor, cuide bem dos aparelhos durante o uso.`,
      `- Você receberá um lembrete automático *10 minutos antes* do encerramento do prazo.`,
      `- Caso precise de suporte ou prorrogação, responda a esta mensagem.`,
      ``,
      `_Equipe FAP Estoque_`
    ].join('\n');

    const enviado = await whatsapp.sendMessage(jid, msg);
    if (enviado) {
      console.log(`[WhatsApp] Notificação de entrega enviada com sucesso para ${req.solicitanteNome} (${jid})`);
    }

    if (req.solicitanteEmail) {
      const emailMsg = `Olá, ${req.solicitanteNome}!\n\nConfirmamos a entrega dos seguintes equipamentos:\n\n${listaItens.replace(/\*/g, '')}\n\nPrevisão de Devolução: ${dataFimStr}\n\nAtenciosamente,\nEquipe FAP Estoque`;
      sendEmail(req.solicitanteEmail, 'Equipamentos Entregues com Sucesso', emailMsg).catch(() => {});
    }

    return !!enviado;
  } catch (error) {
    console.error('[WhatsApp] Erro ao notificar entrega de equipamentos:', error);
    return false;
  }
}

/**
 * Notifica o solicitante quando os equipamentos são DEVOLVIDOS ao estoque.
 * Se houver avarias, informa detalhadamente o número do patrimônio e a descrição do dano.
 */
export async function notificarDevolucaoEquipamentos(
  requisicaoId: string,
  avariasParam?: Array<{ equipamentoNome: string; codigoPatrimonio: string; descricao: string }>
): Promise<boolean> {
  try {
    const req = await prisma.requisicao.findUnique({
      where: { id: requisicaoId },
      include: {
        itens: {
          include: {
            equipamento: true
          }
        },
        historicoAvarias: {
          include: {
            equipamento: true,
            tipoAvaria: true
          }
        }
      }
    });

    if (!req || !req.solicitanteWhatsapp) return false;

    const jid = formatWhatsappJid(req.solicitanteWhatsapp);
    if (!jid) return false;

    // Compila avarias registradas
    const avariasList: Array<{ equipamentoNome: string; codigoPatrimonio: string; descricao: string }> = [];

    if (avariasParam && avariasParam.length > 0) {
      avariasList.push(...avariasParam);
    } else if (req.historicoAvarias && req.historicoAvarias.length > 0) {
      for (const ha of req.historicoAvarias) {
        avariasList.push({
          equipamentoNome: ha.equipamento.nome,
          codigoPatrimonio: ha.equipamento.codigoPatrimonio,
          descricao: ha.descricao || ha.tipoAvaria?.nome || 'Avaria não especificada'
        });
      }
    }

    let msg = '';

    if (avariasList.length === 0) {
      // Devolução perfeita sem avarias
      const listaEquipamentos = req.itens
        .map(i => `• *${i.equipamento.nome}* (Patrimônio: *${i.equipamento.codigoPatrimonio}*)`)
        .join('\n');

      msg = [
        `✅ *Devolução Concluída com Sucesso!*`,
        ``,
        `Olá, *${req.solicitanteNome}*!`,
        `Confirmamos a devolução e conferência dos equipamentos ao estoque:`,
        ``,
        listaEquipamentos,
        ``,
        `✨ Todos os itens foram devolvidos em perfeito estado e sem pendências.`,
        `Agradecemos pelo cuidado e zelo!`,
        ``,
        `_Equipe FAP Estoque_`
      ].join('\n');
    } else {
      // Devolução com relato de avaria
      const blocosAvaria = avariasList
        .map(a => `🔴 *${a.equipamentoNome}* (Patrimônio: *${a.codigoPatrimonio}*)\n   *Defeito/Avaria:* ${a.descricao}`)
        .join('\n\n');

      const idsComAvaria = new Set(avariasList.map(a => a.codigoPatrimonio));
      const itensOk = req.itens.filter(i => !idsComAvaria.has(i.equipamento.codigoPatrimonio));

      const blocoOk = itensOk.length > 0
        ? `\n\n✅ *Demais itens devolvidos em perfeito estado:*\n` +
          itensOk.map(i => `• ${i.equipamento.nome} (Patrimônio: ${i.equipamento.codigoPatrimonio})`).join('\n')
        : '';

      msg = [
        `⚠️ *Devolução Recebida com Registro de Avaria*`,
        ``,
        `Olá, *${req.solicitanteNome}*!`,
        `Confirmamos o recebimento dos equipamentos devolvidos, porém foi registrada avaria/defeito no(s) seguinte(s) item(ns):`,
        ``,
        blocosAvaria,
        blocoOk,
        ``,
        `📌 O registro foi encaminhado para a equipe técnica de manutenção.`,
        `Caso tenha ocorrido algum imprevisto ou tenha dúvidas, por favor procure a administração do estoque.`,
        ``,
        `_Equipe FAP Estoque_`
      ].join('\n');
    }

    const enviado = await whatsapp.sendMessage(jid, msg);
    if (enviado) {
      console.log(`[WhatsApp] Notificação de devolução enviada para ${req.solicitanteNome} (${jid}) - Avarias: ${avariasList.length}`);
    }

    if (req.solicitanteEmail) {
      const emailTitle = avariasList.length === 0 ? 'Equipamentos Devolvidos com Sucesso' : 'Devolução de Equipamentos com Avaria Registrada';
      sendEmail(req.solicitanteEmail, emailTitle, msg.replace(/\*/g, '')).catch(() => {});
    }

    return !!enviado;
  } catch (error) {
    console.error('[WhatsApp] Erro ao notificar devolução de equipamentos:', error);
    return false;
  }
}

/**
 * Envia um lembrete para o solicitante avisando que faltam cerca de 10 minutos para encerrar o período de empréstimo.
 */
export async function notificarLembreteDevolucao(requisicaoId: string): Promise<boolean> {
  try {
    const req = await prisma.requisicao.findUnique({
      where: { id: requisicaoId },
      include: {
        itens: {
          include: {
            equipamento: true
          }
        }
      }
    });

    if (!req || !req.solicitanteWhatsapp) return false;

    const jid = formatWhatsappJid(req.solicitanteWhatsapp);
    if (!jid) return false;

    const listaItens = req.itens
      .map(i => `• *${i.equipamento.nome}* (Patrimônio: *${i.equipamento.codigoPatrimonio}*)`)
      .join('\n');

    const horaFimStr = req.dataFimEvento.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const msg = [
      `⏰ *Lembrete de Devolução (Faltam 10 Minutos)*`,
      ``,
      `Olá, *${req.solicitanteNome}*!`,
      `Lembramos que o prazo de devolução dos seus equipamentos se encerra em aproximadamente *10 minutos* (às *${horaFimStr}*).`,
      ``,
      `📦 *Equipamentos a serem devolvidos:*`,
      listaItens,
      ``,
      `Por favor, organize os aparelhos e dirija-se ao estoque para a conferência e devolução.`,
      `Caso necessite estender o horário de uso, responda imediatamente a esta mensagem!`,
      ``,
      `_Equipe FAP Estoque_`
    ].join('\n');

    const enviado = await whatsapp.sendMessage(jid, msg);

    if (enviado) {
      console.log(`[WhatsApp] Lembrete de 10 minutos enviado para ${req.solicitanteNome} (${jid})`);
      await prisma.requisicao.update({
        where: { id: requisicaoId },
        data: { lembreteDevolucaoEnviado: true }
      });
    }

    return !!enviado;
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar lembrete de devolução:', error);
    return false;
  }
}

/**
 * Monitor periódico do servidor: roda a cada 30 segundos verificando empréstimos ativos
 * cuja dataFimEvento vença dentro dos próximos 10 minutos e ainda não tenham recebido lembrete.
 */
export function iniciarAgendadorLembretes() {
  console.log('[Agendador] Iniciando monitor de lembretes de devolução (10 minutos antes)...');

  setInterval(async () => {
    try {
      const agora = new Date();
      // Janela de lembrete: término entre agora e daqui a 10 minutos (+ 30 segundos de tolerância)
      const limiteFuturo = new Date(agora.getTime() + 10 * 60 * 1000 + 30 * 1000);
      const limitePassado = new Date(agora.getTime() - 15 * 60 * 1000); // Não envia para requisições antigas/vencidas há mais de 15m

      const requisicoesParaLembrar = await prisma.requisicao.findMany({
        where: {
          status: { in: ['EMPRESTADO', 'AGUARDANDO_DEVOLUCAO', 'EM_SEPARACAO'] },
          lembreteDevolucaoEnviado: false,
          solicitanteWhatsapp: { not: null },
          dataFimEvento: {
            gte: limitePassado,
            lte: limiteFuturo
          }
        },
        select: {
          id: true,
          solicitanteNome: true,
          solicitanteWhatsapp: true,
          dataFimEvento: true
        }
      });

      for (const req of requisicoesParaLembrar) {
        await notificarLembreteDevolucao(req.id);
      }
    } catch (err) {
      console.error('[Agendador] Erro no ciclo de verificação de lembretes:', err);
    }
  }, 30000); // Executa a cada 30 segundos
}
