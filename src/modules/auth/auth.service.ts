import { ConflictException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  // register
  async register(registerDto: RegisterDto): Promise<User> {
    try {
      // 1. devide registerDto into password and otherData
      const { password, ...otherData } = registerDto;

      // 2. hash password
      const SALT_ROUNDS = 12;
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // 3. create new user
      const dataToSave = { ...otherData, passwordHash: hashedPassword };

      return await this.usersService.create(dataToSave);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException('Email or username already exists');
      }
      throw error;
    }
  }
}
