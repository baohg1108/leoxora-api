import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EnvConfig } from './config/env.validation';
import { ValidationPipe } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

async function bootstrap() {
  // Create the NestJS application
  const app = await NestFactory.create(AppModule);

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Logger instance
  const logger = new Logger('Bootstrap');

  const configService = app.get<ConfigService<EnvConfig>>(ConfigService);

  const port = configService.getOrThrow<number>('DEV_APP_PORT');

  await app.listen(port);

  logger.log(`Server is running on port ${port}`);
}

bootstrap();
