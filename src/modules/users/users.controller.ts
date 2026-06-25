import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  ParseUUIDPipe,
  Patch,
  Body,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  // create user
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // update user
  @Patch(':id')
  @HttpCode(200)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  // find one
  @Get(':id')
  @HttpCode(200)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // find by email
  @Get('email/:email')
  @HttpCode(200)
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  // find all
  @Get()
  @HttpCode(200)
  findAll() {
    return this.usersService.findAll();
  }

  // soft delete
  @Delete(':id/deactive')
  @HttpCode(204)
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }
}
