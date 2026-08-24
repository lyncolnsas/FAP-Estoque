import nodemailer from 'nodemailer';
import { prisma } from './prisma';

export const sendEmail = async (to: string, subject: string, text: string) => {
  try {
    const configs = await prisma.configuracao.findMany();
    const map = configs.reduce((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {} as any);

    if (!map['smtp_host'] || !map['smtp_port'] || !map['smtp_user'] || !map['smtp_pass']) {
      console.log('[Email] Configurações SMTP ausentes. E-mail não enviado.');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: map['smtp_host'],
      port: Number(map['smtp_port']),
      secure: Number(map['smtp_port']) === 465,
      auth: {
        user: map['smtp_user'],
        pass: map['smtp_pass']
      }
    });

    await transporter.sendMail({
      from: `"Slave Estoque" <${map['smtp_user']}>`,
      to,
      subject,
      text
    });

    console.log(`[Email] E-mail enviado com sucesso para ${to}`);
    return true;
  } catch (error) {
    console.error('[Email] Erro ao enviar e-mail:', error);
    return false;
  }
};
