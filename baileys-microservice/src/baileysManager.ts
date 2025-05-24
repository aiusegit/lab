import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  WAMessage,
  WASocket,
  proto,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Ensure SESSION_FILE_PATH uses the path specified in the prompt's .env.example
const SESSION_FILE_PATH = process.env.SESSION_FILE_PATH || './whatsapp_sessions/baileys_auth_state';
const NESTJS_WEBHOOK_URL = process.env.NESTJS_WEBHOOK_URL;
const NESTJS_WEBHOOK_API_KEY = process.env.NESTJS_WEBHOOK_API_KEY;

let sock: WASocket | null = null;
let connectionStatus: string = 'disconnected';
let qrData: string | null = null;
let connectedJid: string | null = null;
let connectionAttempts = 0;
const maxConnectionAttempts = 5;


const handleConnectionUpdate = async (update: Partial<any>) => {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    qrData = qr;
    connectionStatus = 'qr_received';
    logger.info('QR code received. Scan with WhatsApp:');
    qrcodeTerminal.generate(qr, { small: true });
  }

  if (connection === 'close') {
    qrData = null; // Clear QR on close
    connectedJid = null;
    const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
    connectionStatus = `closed (Reason: ${DisconnectReason[lastDisconnect?.error?.output?.statusCode] || 'Unknown'}, Reconnecting: ${shouldReconnect})`;
    logger.error(`Connection closed due to: ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
    
    if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000 * Math.pow(2, connectionAttempts > 4 ? 4 : connectionAttempts)); // Exponential backoff
    } else {
      logger.error('Logged out. Please delete session files and restart to re-authenticate.');
      // Optionally clean session directory if not loggedOut explicitly by user.
      // For now, manual cleanup is safer.
    }
  } else if (connection === 'open') {
    connectionStatus = 'connected';
    qrData = null;
    connectedJid = jidNormalizedUser(sock?.user?.id);
    logger.info(`WhatsApp connection opened successfully. Connected as JID: ${connectedJid}`);
    connectionAttempts = 0; // Reset attempts on successful connection
  }
};

const handleMessagesUpsert = async (m: { messages: WAMessage[], type: any }) => {
  if (m.type === 'notify' && m.messages) {
    for (const msg of m.messages) {
      if (msg.key.fromMe || !msg.message || msg.key.remoteJid === 'status@broadcast') {
        // logger.debug({ msgId: msg.key.id }, 'Skipping own message, empty message, or status broadcast');
        continue;
      }

      logger.info({ msgId: msg.key.id, from: msg.key.remoteJid }, 'Received new message');
      
      if (!NESTJS_WEBHOOK_URL) {
        logger.warn('NESTJS_WEBHOOK_URL not configured. Cannot send incoming message webhook.');
        continue;
      }

      const payload = {
        messageId: msg.key.id,
        senderJid: msg.key.remoteJid,
        participantJid: msg.key.participant, // For groups
        messageTimestamp: msg.messageTimestamp,
        pushName: msg.pushName,
        content: msg.message, // Full message object, NestJS can parse text, image, etc.
        // Add any other relevant fields you need from `msg`
      };

      try {
        await axios.post(NESTJS_WEBHOOK_URL, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': NESTJS_WEBHOOK_API_KEY || '',
          },
          timeout: 10000, // 10-second timeout
        });
        logger.info({ msgId: msg.key.id }, 'Successfully sent incoming message to NestJS webhook.');
      } catch (error: any) {
        logger.error(
          { msgId: msg.key.id, error: error.message, status: error.response?.status },
          'Failed to send incoming message to NestJS webhook.'
        );
      }
    }
  }
};

export const connectToWhatsApp = async (): Promise<void> => {
  connectionAttempts++;
  if (connectionAttempts > maxConnectionAttempts && maxConnectionAttempts > 0) {
    logger.error(`Max connection attempts (${maxConnectionAttempts}) reached. Aborting automatic reconnect.`);
    connectionStatus = `max_attempts_reached (Attempts: ${connectionAttempts-1})`;
    return;
  }
  
  if (sock) { // If a previous socket exists, ensure it's properly closed or listeners removed
    logger.warn('Previous socket instance detected. Attempting to clean up before reconnecting.');
    try {
        sock.ev.removeAllListeners(); // Remove all listeners
        await sock.logout(); // Attempt to gracefully close
    } catch (e: any) {
        logger.error({ err: e.message }, "Error cleaning up old socket, proceeding with new one.");
    }
    sock = null;
  }


  connectionStatus = `connecting (Attempt: ${connectionAttempts})`;
  logger.info(`Attempting to connect to WhatsApp (Attempt ${connectionAttempts})...`);

  try {
    // Ensure session directory exists
    if (!fs.existsSync(SESSION_FILE_PATH)) {
      fs.mkdirSync(SESSION_FILE_PATH, { recursive: true });
      logger.info(`Created session directory: ${SESSION_FILE_PATH}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FILE_PATH);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

    sock = makeWASocket({
      version,
      logger: logger as any, // Cast to Baileys logger type
      printQRInTerminal: false, // We handle QR with qrcode-terminal and store it
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger as any),
      },
      generateHighQualityLinkPreview: true,
      shouldIgnoreJid: (jid) => jid?.includes('broadcast'), // Example: ignore broadcast messages
      // Other options as needed
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', handleConnectionUpdate);
    sock.ev.on('messages.upsert', handleMessagesUpsert);

  } catch (error: any) {
    logger.error(`Error initializing Baileys client: ${error.message}`, error.stack);
    connectionStatus = `error_initializing (Reason: ${error.message})`;
    if (connectionAttempts <= maxConnectionAttempts || maxConnectionAttempts === 0) {
      logger.info(`Retrying connection in ${5 * Math.pow(2, connectionAttempts > 4 ? 4 : connectionAttempts)} seconds...`);
      setTimeout(connectToWhatsApp, 5000 * Math.pow(2, connectionAttempts > 4 ? 4 : connectionAttempts));
    }
  }
};

export const sendMessage = async (jid: string, text: string): Promise<proto.WebMessageInfo | null> => {
  if (!sock || connectionStatus !== 'connected') {
    logger.error('Cannot send message: WhatsApp client not connected.');
    throw new Error('WhatsApp client not connected.');
  }
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@g.us')) {
      jid = `${jid}@s.whatsapp.net`; // Assume individual user if not specified
  }
  jid = jidNormalizedUser(jid);


  try {
    logger.info({ to: jid }, `Sending message: "${text}"`);
    const messageSent = await sock.sendMessage(jid, { text });
    logger.info({ msgId: messageSent.key.id, to: jid }, 'Message sent successfully.');
    return messageSent;
  } catch (error: any) {
    logger.error({ to: jid, error: error.message }, 'Failed to send message.');
    throw error;
  }
};

export const getConnectionStatus = (): { status: string, qrData?: string, jid?: string } => {
  return { status: connectionStatus, qrData: qrData || undefined , jid: connectedJid || undefined };
};

// Initial connection attempt
// connectToWhatsApp(); // server.ts will call this after initial setup.Okay, I have already created `baileys-microservice/package.json`, `baileys-microservice/.env.example`, `baileys-microservice/tsconfig.json`, and `baileys-microservice/src/baileysManager.ts` in the previous turns.

**Recap of what was done for `baileysManager.ts`:**
*   Handles `makeWASocket` with `useMultiFileAuthState` using `SESSION_FILE_PATH` from env.
*   Manages connection status, QR code generation (logs to console with `qrcode-terminal` and stores `qrData` string).
*   On `messages.upsert`, formats a payload and POSTs to `NESTJS_WEBHOOK_URL` using `axios`, including `X-Api-Key` header with `NESTJS_WEBHOOK_API_KEY`.
*   Exposes methods: `sendMessage(jid: string, text: string): Promise<any>`, `getConnectionStatus(): { status: string, qrData?: string, jid?: string }`, and `connectToWhatsApp()`.
*   Uses `pino` for logging.

Now, I'll proceed to create `baileys-microservice/src/api.ts`.
