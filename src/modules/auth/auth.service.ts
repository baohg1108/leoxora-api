import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}
@Injectable()
export class AuthService {
  // define timing attack
  private readonly DUMMY_HASH =
    '$2b$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummy';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // register
  async register(registerDto: RegisterDto): Promise<User> {
    try {
      const { password, ...otherData } = registerDto;
      const saltRounds = Number(
        this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS'),
      );
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const dataToSave = { ...otherData, passwordHash: hashedPassword };

      return await this.usersService.create(dataToSave);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const dbError = error as QueryFailedError & {
          code?: string;
        };

        if (dbError.code === '23505') {
          throw new ConflictException('Email or username already exists');
        }
      }

      throw error;
    }
  }

  // login
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
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

    const payload: JwtPayload = {
      sub: existingUser.id,
      email: existingUser.email,
      role: existingUser.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      id: existingUser.id,
      email: existingUser.email,
      role: existingUser.role,
      accessToken,
    };
  }
}
