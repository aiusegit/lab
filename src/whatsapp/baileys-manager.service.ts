import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  WASocket,
  WAMessage,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import { Subject } from 'rxjs';

// Define the directory for session files
const SESSION_DIR = path.join(process.cwd(), 'whatsapp_sessions');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}
const AUTH_STATE_PATH = path.join(SESSION_DIR, 'baileys_auth_state');

@Injectable()
export class BaileysManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysManagerService.name);
  private sock: WASocket | null = null;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;

  // Subject to emit incoming messages to any subscribers (like WhatsAppService)
  private incomingMessageSubject = new Subject<{ message: WAMessage; rawEvents: any }>();
  public incomingMessage$ = this.incomingMessageSubject.asObservable();
  private waJid: string | null = null;


  constructor() {
    // Ensure process.stdout is available (it might not be in some PM2/Docker environments without proper TTY)
    if (!process.stdout.isTTY) {
        this.logger.warn('Non-TTY environment detected. QR code display in console might not work as expected.');
    }
  }

  async onModuleInit() {
    this.logger.log('BaileysManagerService initializing...');
    await this.connectToWhatsApp();
  }

  async onModuleDestroy() {
    this.logger.log('BaileysManagerService destroying...');
    if (this.sock) {
      this.logger.log('Closing WhatsApp connection.');
      await this.sock.logout(); // or sock.end(new Error('Server shutting down'))
      this.sock = null;
    }
  }

  private async connectToWhatsApp() {
    this.connectionAttempts++;
    if (this.connectionAttempts > this.maxConnectionAttempts) {
      this.logger.error(`Max connection attempts (${this.maxConnectionAttempts}) reached. Aborting.`);
      return;
    }

    this.logger.log(`Attempting to connect to WhatsApp (Attempt ${this.connectionAttempts})...`);

    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_STATE_PATH);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.log(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

      this.sock = makeWASocket({
        version,
        logger: this.logger as any, // Cast to Baileys logger type if necessary
        printQRInTerminal: true, // This is crucial
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger as any),
        },
        generateHighQualityLinkPreview: true,
        // Other options as needed
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          this.logger.log('QR code received, please scan:');
          // QR is automatically printed to terminal by Baileys if printQRInTerminal is true
        }
        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          this.logger.error(`Connection closed due to: ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
          if (shouldReconnect) {
            // Add a small delay before attempting to reconnect
            setTimeout(() => this.connectToWhatsApp(), 5000);
          } else {
            this.logger.error('Logged out. Please delete session files and restart to re-authenticate.');
            // Optionally, clean up session files
            // if (fs.existsSync(AUTH_STATE_PATH)) {
            //   fs.rmSync(AUTH_STATE_PATH, { recursive: true, force: true });
            //   this.logger.log('Session files deleted.');
            // }
          }
        } else if (connection === 'open') {
          this.logger.log('WhatsApp connection opened successfully.');
          this.waJid = this.sock?.user?.id || null;
          this.logger.log(`Connected as JID: ${this.waJid}`);
          this.connectionAttempts = 0; // Reset attempts on successful connection
        }
      });

      this.sock.ev.on('messages.upsert', (m) => {
        // m.messages contains the new messages
        // m.type is 'notify' or 'append'
        // For MVP, we process only new 'notify' messages
        if (m.type === 'notify' && m.messages) {
            m.messages.forEach(msg => {
                // Basic check to ignore broadcast/status messages or messages from self for now
                if (msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) {
                    return;
                }
                // Ensure message content exists
                if (!msg.message) {
                    this.logger.debug(`Received message without content (ID: ${msg.key.id}). Skipping.`);
                    return;
                }
                this.logger.log(`Received new message: ${JSON.stringify(msg)}`);
                this.incomingMessageSubject.next({ message: msg, rawEvents: m });
            });
        }
      });

    } catch (error) {
      this.logger.error(`Error initializing Baileys client: ${error.message}`, error.stack);
      if (this.connectionAttempts <= this.maxConnectionAttempts) {
        this.logger.log(`Retrying connection in 10 seconds...`);
        setTimeout(() => this.connectToWhatsApp(), 10000);
      }
    }
  }

  async getSocket(): Promise<WASocket | null> {
    if (!this.sock || this.sock.ws.readyState !== WebSocket.OPEN) { // WebSocket is not a type here, check internal state if possible
        this.logger.warn('Socket not available or not open.');
        // Potentially wait for connection or re-initiate
        // For now, just returning current state
        return null;
    }
    return this.sock;
  }
  
  getWhatsAppJid(): string | null {
    return this.waJid;
  }
}
