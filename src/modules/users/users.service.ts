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

  // update user
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(`Not found user with id: ${id}`);
    }

    const updatedUser = this.usersRepository.merge(existingUser, updateUserDto);
    return this.usersRepository.save(updatedUser);
  }

  // find one
  async findOne(id: string): Promise<User | null> {
    const existingUser = await this.usersRepository.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(`Not found user with id: ${id}`);
    }
    return existingUser;
  }

  // soft delete
  async softDelete(id: string): Promise<void> {
    const result = await this.usersRepository.softDelete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Not found user with id: ${id}`);
    }
  }
}
