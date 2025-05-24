import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  app.enableCors(); // Basic CORS setup, configure as needed

  // Global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips away properties not defined in DTO
      transform: true, // Automatically transforms payloads to DTO instances
      // forbidNonWhitelisted: true, // Optional: Throws error if non-whitelisted properties are present
    }),
  );
  
  // Allow class-validator to use NestJS DI container for custom validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`GraphQL Playground (if enabled) running on http://localhost:${port}/graphql`);
}
bootstrap();
