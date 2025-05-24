import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgUiIntegrationService } from './ag-ui-integration.service';

@Global() // Make AgUiIntegrationService easily injectable across other modules
@Module({
  imports: [ConfigModule], // Ensure ConfigService is available
  providers: [AgUiIntegrationService],
  exports: [AgUiIntegrationService],
})
export class AgUiModule {}
