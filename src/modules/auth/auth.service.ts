import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { JwtPayload } from './types/jwt-payload.type';

type LoginResponseAndRefreshToken = LoginResponseDto & { refreshToken: string };

@Injectable()
export class AuthService {
  private readonly DUMMY_HASH =
    '$2b$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummy';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // helper function to generate access and refresh tokens
  async generateTokens(
    userId: string,
    email: string,
    role: JwtPayload['role'],
  ) {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_TOKEN_EXPIRATION_TIME',
        ) as StringValue,
        secret: this.configService.getOrThrow<string>(
          'JWT_ACCESS_TOKEN_SECRET',
        ),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_TOKEN_EXPIRATION_TIME',
        ) as StringValue,
        secret: this.configService.getOrThrow<string>(
          'JWT_REFRESH_TOKEN_SECRET',
        ),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  // refresh token
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findOne(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return tokens;
  }

  // hash refresh token new
  async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const saltRounds =
      this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS');

    const hashedRefreshToken = await bcrypt.hash(refreshToken, saltRounds);
    await this.usersService.updateRefreshTokenHash(userId, hashedRefreshToken);
  }

  // register
  async register(registerDto: RegisterDto): Promise<User> {
    try {
      const { password, ...otherData } = registerDto;
      const saltRounds =
        this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS');
      const passwordHash = await bcrypt.hash(password, saltRounds);

      return await this.usersService.create({ ...otherData, passwordHash });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const dbError = error as QueryFailedError & { code?: string };
        if (dbError.code === '23505') {
          throw new ConflictException('Email already exists');
        }
      }

      throw error;
    }
  }

  // login
  async login(loginDto: LoginDto): Promise<LoginResponseAndRefreshToken> {
    const { email, password } = loginDto;

    const existingUser = await this.usersService.findByEmail(email);

    if (!existingUser) {
      await bcrypt.compare(password, this.DUMMY_HASH);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(
      existingUser.id,
      existingUser.email,
      existingUser.role,
    );

    await this.updateRefreshTokenHash(existingUser.id, tokens.refreshToken);

    return {
      id: existingUser.id,
      email: existingUser.email,
      role: existingUser.role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // logout
  async logout(userId: string) {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  // who am i
  async whoAmI(userId: string): Promise<User> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
