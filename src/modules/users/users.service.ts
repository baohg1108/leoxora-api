import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // create user
  async create(data: {
    email: string;
    fullName: string;
    avatarUrl?: string;
    passwordHash: string;
  }): Promise<User> {
    const newUser = this.usersRepository.create(data);
    return this.usersRepository.save(newUser);
  }

  // update user
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const existingUser = await this.findOne(id);
    const updatedUser = this.usersRepository.merge(existingUser, updateUserDto);
    return this.usersRepository.save(updatedUser);
  }

  // update refresh token hash
  async updateRefreshTokenHash(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.usersRepository.update(userId, { hashedRefreshToken });
  }

  // find one
  async findOne(id: string): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(`Not found user with id: ${id}`);
    }
    return existingUser;
  }

  // find by email
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  // find all
  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  // soft delete
  async softDelete(id: string): Promise<void> {
    const result = await this.usersRepository.softDelete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Not found user with id: ${id}`);
    }
  }
}
