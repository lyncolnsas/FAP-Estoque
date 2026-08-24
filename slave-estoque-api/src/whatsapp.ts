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

  public async sendMessage(toJid: string, content: string) {
    if (!this.sock) {
      console.log('[WhatsApp] Erro: Socket não conectado.');
      return false;
    }
    
    try {
      await this.sock.sendPresenceUpdate('composing', toJid);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulando digitação
      
      await this.sock.sendMessage(toJid, { text: content });
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
      await this.sock.sendPresenceUpdate('composing', toJid);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulando digitação
      
      let imagePayload: any;
      if (imageUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', imageUrl);
        if (fs.existsSync(filePath)) {
          imagePayload = fs.readFileSync(filePath);
        } else {
          imagePayload = { url: imageUrl }; // fallback
        }
      } else {
        imagePayload = { url: imageUrl };
      }

      await this.sock.sendMessage(toJid, { image: imagePayload, caption });
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
}


export const whatsapp = new WhatsappSpecialist('system');

