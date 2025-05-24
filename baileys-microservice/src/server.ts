import express from 'express';
import dotenv from 'dotenv';
import pino from 'pino';
import apiRoutes from './api';
import { connectToWhatsApp, getConnectionStatus } from './baileysManager';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(express.json());

// Mount API routes
app.use('/api', apiRoutes); // Prefix all API routes with /api

// Simple root endpoint for health check or basic info
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Baileys WhatsApp Service is running.',
    serviceStatus: getConnectionStatus() 
  });
});

// Start Express server
const server = app.listen(port, async () => {
  logger.info(`Baileys Service API listening on http://localhost:${port}`);
  
  // Initialize and connect Baileys client
  // Adding a small delay to ensure server setup is complete before heavy Baileys init
  setTimeout(async () => {
    try {
      logger.info('Initializing Baileys WhatsApp connection...');
      await connectToWhatsApp();
      logger.info('Baileys connectToWhatsApp process initiated.');
      const initialStatus = getConnectionStatus();
      logger.info(`Initial Baileys status: ${initialStatus.status}`);
      if(initialStatus.qrData) {
          logger.info('QR code available via /api/status endpoint or initial console output.');
      }
    } catch (error) {
      logger.error('Failed to initialize Baileys connection on startup:', error);
    }
  }, 1000); // 1-second delay
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    // Here you might want to add cleanup for Baileys connection if needed,
    // though Baileys itself might handle this on process exit or DisconnectReason.loggedOut.
    // For example, sock.logout() or sock.end() if sock instance is accessible here.
    // For now, relying on Baileys internal cleanup and process termination.
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
