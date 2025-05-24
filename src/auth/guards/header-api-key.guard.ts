import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class HeaderApiKeyAuthGuard implements CanActivate {
  private readonly logger = new Logger(HeaderApiKeyAuthGuard.name);
  private readonly expectedApiKey: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly apiKeyEnvVarName: string, // e.g., 'BAILEYS_WEBHOOK_API_KEY'
  ) {
    this.expectedApiKey = this.configService.get<string>(this.apiKeyEnvVarName);
    if (!this.expectedApiKey) {
      this.logger.warn(`API Key for ${this.apiKeyEnvVarName} is not configured. Guard will deny all requests.`);
    }
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (!this.expectedApiKey) {
      this.logger.error(`Access denied: API Key ${this.apiKeyEnvVarName} not configured on server side.`);
      throw new UnauthorizedException('Access Denied: Service configuration error.');
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      this.logger.warn('Access denied: No API Key provided in X-Api-Key header.');
      throw new UnauthorizedException('Access Denied: Missing API Key.');
    }

    if (apiKey === this.expectedApiKey) {
      return true;
    } else {
      this.logger.warn('Access denied: Invalid API Key provided.');
      // Do not log the provided API key for security reasons, just that it was invalid.
      throw new UnauthorizedException('Access Denied: Invalid API Key.');
    }
  }
}
