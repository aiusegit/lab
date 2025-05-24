import express, { Request, Response, NextFunction, Router } from 'express';
import { sendMessage, getConnectionStatus } from './baileysManager';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = Router();

const BAILEYS_API_KEY_INTERNAL = process.env.BAILEYS_API_KEY_INTERNAL;

// API Key Middleware
const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (!BAILEYS_API_KEY_INTERNAL) {
    logger.warn('BAILEYS_API_KEY_INTERNAL is not set. API requests will not be authenticated.');
    return next(); // Allow if no API key is configured on server, but log warning
  }
  if (apiKey && apiKey === BAILEYS_API_KEY_INTERNAL) {
    next();
  } else {
    logger.warn({ remoteIp: req.ip, apiKeyProvided: apiKey ? 'Yes' : 'No' }, 'Unauthorized API access attempt.');
    res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }
};

router.use(apiKeyMiddleware);

// POST /message/send
// Body: { "jid": "1234567890", "text": "Hello there!" }
router.post('/message/send', async (req: Request, res: Response) => {
  const { jid, text } = req.body;

  if (!jid || !text) {
    return res.status(400).json({ error: 'Missing jid or text in request body' });
  }
  if (typeof jid !== 'string' || typeof text !== 'string') {
    return res.status(400).json({ error: 'jid and text must be strings' });
  }

  try {
    logger.info({ jid }, `Received API request to send message.`);
    const result = await sendMessage(jid, text);
    if (result) {
      res.status(200).json({ success: true, messageId: result.key.id, status: result.status });
    } else {
      // This case might not be hit if sendMessage throws an error directly
      res.status(500).json({ success: false, error: 'Failed to send message, no result returned.' });
    }
  } catch (error: any) {
    logger.error({ jid, error: error.message }, 'Error sending message via API.');
    // Check if error is from BaileysManager (e.g., "WhatsApp client not connected.")
    if (error.message === 'WhatsApp client not connected.') {
        return res.status(503).json({ success: false, error: 'Service Unavailable: WhatsApp client not connected.' });
    }
    res.status(500).json({ success: false, error: error.message || 'Internal server error sending message' });
  }
});

// GET /status
router.get('/status', (req: Request, res: Response) => {
  logger.info('Received API request for Baileys connection status.');
  const status = getConnectionStatus();
  res.status(200).json(status);
});

export default router;
