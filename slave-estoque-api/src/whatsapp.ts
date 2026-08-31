import pino from 'pino';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

export class WhatsappSpecialist {
  private sock: any = null;
  private readonly sessionDir: string;
  private isInWaitMode: boolean = false;
  private qrCount: number = 0;
  private store: any = null;

  constructor(private sessionId: string) {
    this.sessionDir = path.join(os.tmpdir(), `baileys_session_${sessionId}`);
  }

  public async connect() {
    if (this.isInWaitMode) {
      console.log('[WhatsApp] Em modo de espera. Aguardando ação manual.');
      (global as any).whatsappStatus = 'MODO_ESPERA';
      return;
    }

    const baileys = await eval('import("@whiskeysockets/baileys")');
    const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

    if (!this.store) {
      this.store = { contacts: {} };
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any
    });

    this.sock.ev.on('contacts.upsert', (contacts: any[]) => {
      for (const contact of contacts) {
        this.store.contacts[contact.id] = Object.assign(
          this.store.contacts[contact.id] || {},
          contact
        );
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        this.qrCount++;
        console.log(`[WhatsApp] Escaneie o QR Code para conectar a sessão ${this.sessionId}:`);
        qrcode.generate(qr, { small: true });
        (global as any).whatsappQrCode = qr;
        (global as any).whatsappStatus = 'AGUARDANDO_QR';
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Conexão fechada. Status: ${statusCode}. Reconectar: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          // Se gerou QR Code e a conexão caiu (provavelmente expirou), entramos em modo de espera
          if (this.qrCount >= 2) {
            console.log('[WhatsApp] QR Code expirou 2 vezes. Entrando em modo de espera.');
            this.isInWaitMode = true;
            (global as any).whatsappStatus = 'MODO_ESPERA';
            (global as any).whatsappQrCode = null;
            if (this.sock) {
                this.sock.ws?.close();
            }
          } else {
            (global as any).whatsappStatus = 'DESCONECTADO';
            setTimeout(() => this.connect(), 5000);
          }
        } else {
          console.log('[WhatsApp] Deslogado. Removendo sessão...');
          this.clearSession();
        }
      } else if (connection === 'open') {
        console.log(`[WhatsApp] Conectado com sucesso na sessão ${this.sessionId}!`);
        this.qrCount = 0;
        this.isInWaitMode = false;
        (global as any).whatsappStatus = 'CONECTADO';
        (global as any).whatsappQrCode = null;
      }
    });

    return this.sock;
  }

  public async reconnect() {
    console.log('[WhatsApp] Solicitada reconexão manual...');
    this.isInWaitMode = false;
    this.qrCount = 0;
    if (this.sock) {
      this.sock.ws?.close();
    }
    return this.connect();
  }

  public async disconnect() {
    console.log('[WhatsApp] Solicitada desconexão manual...');
    this.isInWaitMode = false;
    this.qrCount = 0;
    
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (e) {
        console.error('Erro ao fazer logout:', e);
      }
      this.sock.ws?.close();
    }
    
    this.clearSession();
  }

  private clearSession() {
    fs.rmSync(this.sessionDir, { recursive: true, force: true });
    (global as any).whatsappQrCode = null;
    (global as any).whatsappStatus = 'DESCONECTADO';
    this.sock = null;
  }

  /**
   * Normaliza e resolve o JID exato registrado nos servidores do WhatsApp,
   * tratando números brasileiros com/sem o 9º dígito e com/sem DDI 55.
   */
  public async resolveJid(jidOrPhone: string): Promise<string | null> {
    if (!jidOrPhone) return null;
    let clean = jidOrPhone.trim();
    if (!clean.includes('@')) {
      let digits = clean.replace(/\D/g, '');
      if (digits.length < 8) return null;
      if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
      }
      clean = `${digits}@s.whatsapp.net`;
    }

    if (!this.sock) return clean;

    try {
      // 1. Tenta encontrar no WhatsApp o JID direto
      const check1 = await this.sock.onWhatsApp(clean);
      if (check1 && check1.length > 0 && check1[0]?.exists) {
        return check1[0].jid;
      }

      // 2. Se for número brasileiro com 9 dígitos (ex: 5511999998888@s.whatsapp.net), tenta sem o 9 (551199998888@s.whatsapp.net)
      const matchBr9 = clean.match(/^55(\d{2})9(\d{8})@s\.whatsapp\.net$/);
      if (matchBr9) {
        const altJid = `55${matchBr9[1]}${matchBr9[2]}@s.whatsapp.net`;
        const check2 = await this.sock.onWhatsApp(altJid);
        if (check2 && check2.length > 0 && check2[0]?.exists) {
          return check2[0].jid;
        }
      }

      // 3. Se for número brasileiro com 8 dígitos (ex: 551199998888@s.whatsapp.net), tenta com o 9 (5511999998888@s.whatsapp.net)
      const matchBr8 = clean.match(/^55(\d{2})(\d{8})@s\.whatsapp\.net$/);
      if (matchBr8) {
        const altJid = `55${matchBr8[1]}9${matchBr8[2]}@s.whatsapp.net`;
        const check3 = await this.sock.onWhatsApp(altJid);
        if (check3 && check3.length > 0 && check3[0]?.exists) {
          return check3[0].jid;
        }
      }
    } catch (e) {
      // Silenciosamente continua com o clean formatado
    }

    return clean;
  }

  public async sendMessage(toJid: string, content: string) {
    if (!this.sock) {
      console.log('[WhatsApp] Erro: Socket não conectado.');
      return false;
    }
    
    try {
      const targetJid = await this.resolveJid(toJid);
      if (!targetJid) {
        console.warn('[WhatsApp] Destinatário inválido:', toJid);
        return false;
      }

      await this.sock.sendPresenceUpdate('composing', targetJid);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulando digitação
      
      await this.sock.sendMessage(targetJid, { text: content });
      return true;
    } catch (err) {
      console.error('[WhatsApp] Erro ao enviar mensagem:', err);
      return false;
    }
  }

  public async sendMediaMessage(toJid: string, imageUrl: string, caption: string) {
    if (!this.sock) {
      console.log('[WhatsApp] Erro: Socket não conectado.');
      return false;
    }
    
    try {
      const targetJid = await this.resolveJid(toJid);
      if (!targetJid) {
        console.warn('[WhatsApp] Destinatário inválido:', toJid);
        return false;
      }

      await this.sock.sendPresenceUpdate('composing', targetJid);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulando digitação
      
      let imagePayload: any;
      if (imageUrl.startsWith('/uploads/')) {
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
        const filePath = path.join(uploadDir, path.basename(imageUrl));
        if (fs.existsSync(filePath)) {
          imagePayload = fs.readFileSync(filePath);
        } else {
          imagePayload = { url: imageUrl };
        }
      } else {
        imagePayload = { url: imageUrl };
      }

      await this.sock.sendMessage(targetJid, { image: imagePayload, caption });
      return true;
    } catch (err) {
      console.error('[WhatsApp] Erro ao enviar mensagem com mídia:', err);
      return false;
    }
  }

  public getContacts() {
    if (!this.store) return [];
    // Convert store.contacts (dictionary) to array
    const contacts = Object.values(this.store.contacts || {});
    // Filter out groups, broadcast lists, and undefined names
    return contacts
      .filter((c: any) => c.id && c.name && !c.id.endsWith('@g.us') && !c.id.endsWith('@broadcast'))
      .map((c: any) => ({
        id: c.id,
        name: c.name || c.notify || 'Desconhecido',
        number: c.id.split('@')[0]
      }));
  }

  /**
   * Busca a foto de perfil do contato no WhatsApp, baixa o arquivo para a pasta de uploads
   * do servidor para garantir persistência (evitando expiração de CDN) e retorna a URL local /uploads/...
   */
  public async getProfilePictureUrl(jidOrPhone: string): Promise<string | null> {
    if (!this.sock) return null;
    try {
      const jid = await this.resolveJid(jidOrPhone);
      if (!jid) return null;

      // Lista de possíveis JIDs para testar (com e sem nono dígito)
      const candidateJids: string[] = [jid];
      const matchBr9 = jid.match(/^55(\d{2})9(\d{8})@s\.whatsapp\.net$/);
      if (matchBr9) {
        candidateJids.push(`55${matchBr9[1]}${matchBr9[2]}@s.whatsapp.net`);
      }
      const matchBr8 = jid.match(/^55(\d{2})(\d{8})@s\.whatsapp\.net$/);
      if (matchBr8) {
        candidateJids.push(`55${matchBr8[1]}9${matchBr8[2]}@s.whatsapp.net`);
      }

      let remoteUrl: string | null = null;
      for (const targetJid of candidateJids) {
        // Tenta qualidade HD/alta primeiro
        try {
          remoteUrl = await this.sock.profilePictureUrl(targetJid, 'image');
          if (remoteUrl) break;
        } catch (e) {}

        // Se não conseguir 'image', tenta 'preview' (thumbnail padrão)
        try {
          remoteUrl = await this.sock.profilePictureUrl(targetJid, 'preview');
          if (remoteUrl) break;
        } catch (e) {}
      }

      if (!remoteUrl) return null;

      // Baixa e persiste a foto localmente para evitar expiração do link do WhatsApp CDN
      if (remoteUrl.startsWith('http')) {
        try {
          const cleanDigits = jid.replace(/\D/g, '');
          const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const filename = `perfil-wa-${cleanDigits}.jpg`;
          const targetPath = path.join(uploadDir, filename);

          const resp = await fetch(remoteUrl);
          if (resp.ok) {
            const buffer = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(targetPath, buffer);
            return `/uploads/${filename}`;
          }
        } catch (dlErr) {
          console.warn('[WhatsApp] Aviso: Não foi possível salvar foto localmente, utilizando URL direta:', dlErr);
        }
      }

      return remoteUrl || null;
    } catch (e) {
      return null;
    }
  }
}


export const whatsapp = new WhatsappSpecialist('system');

