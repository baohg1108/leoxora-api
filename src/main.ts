import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EnvConfig } from './config/env.validation';

async function bootstrap() {
  // Create the NestJS application
  const app = await NestFactory.create(AppModule);

  // Logger instance
  const logger = new Logger('Bootstrap');

  const configService = app.get<ConfigService<EnvConfig>>(ConfigService);

  const port = configService.getOrThrow<number>('DEV_APP_PORT');

  await app.listen(port);

  logger.log(`Server is running on port ${port}`);
}

bootstrap();
