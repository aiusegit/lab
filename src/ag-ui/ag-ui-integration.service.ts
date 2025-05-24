import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios'; // Using axios for HTTP requests

@Injectable()
export class AgUiIntegrationService {
  private readonly logger = new Logger(AgUiIntegrationService.name);
  private readonly agUiProxyUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.agUiProxyUrl = this.configService.get<string>('AGUI_PROXY_URL');
    if (!this.agUiProxyUrl) {
      this.logger.warn('AGUI_PROXY_URL is not configured. AG-UI event publishing will be disabled.');
    }
  }

  /**
   * Publishes an event to the AG-UI Proxy Server.
   * @param eventType - The type of the event (e.g., 'deal_stage_updated').
   * @param eventData - The payload of the event.
   * @param tenantId - The business tenant ID to scope the event.
   */
  async publishEvent(eventType: string, eventData: any, tenantId: string): Promise<void> {
    if (!this.agUiProxyUrl) {
      this.logger.debug(`AG-UI Proxy URL not configured. Skipping event publish for type: ${eventType}`);
      return;
    }

    const payload = {
      type: eventType,
      data: eventData,
      tenant: tenantId, // Business tenant ID
      timestamp: new Date().toISOString(),
    };

    const targetUrl = `${this.agUiProxyUrl}/events`; // Assuming AG-UI Proxy endpoint

    try {
      this.logger.log(`Publishing AG-UI event to ${targetUrl}: Type=${eventType}, Tenant=${tenantId}`);
      await axios.post(targetUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000, // 5-second timeout
      });
      this.logger.log(`Successfully published AG-UI event: Type=${eventType}, Tenant=${tenantId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to publish AG-UI event to ${targetUrl}. Status: ${error.response?.status}. Data: ${JSON.stringify(error.response?.data)}. Message: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `An unexpected error occurred while publishing AG-UI event to ${targetUrl}: ${error.message}`,
          error.stack,
        );
      }
      // Depending on requirements, might throw error or handle gracefully
    }
  }
}
