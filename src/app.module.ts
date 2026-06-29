import { Module } from '@nestjs/common';
import { validateEnv } from './config/env.validation';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessTokenGuard } from './common/guards/access-token.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const configDb = configService.get<TypeOrmModuleOptions>('database');
        if (!configDb) {
          throw new Error('Database configuration is missing');
        }
        return configDb;
      },
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
  ],
  providers: [AccessTokenGuard],
})
export class AppModule {}
