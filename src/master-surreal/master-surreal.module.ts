import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MasterSurrealService } from './master-surreal.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MasterSurrealService],
  exports: [MasterSurrealService],
})
export class MasterSurrealModule {}
