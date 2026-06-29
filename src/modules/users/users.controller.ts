import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  ParseUUIDPipe,
  Patch,
  Body,
  // UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
// import { Roles } from '../../common/decorators/roles.decorator';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { OwnerOrAdminGuard } from '../../common/guards/owner-or-admin.guard';
// import { UserRole } from '../../common/enums/user-role.enum';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // @Roles(UserRole.ADMIN)
  // @UseGuards(RolesGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // @Roles(UserRole.ADMIN)
  // @UseGuards(RolesGuard)
  @Get('email/:email')
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  // @UseGuards(OwnerOrAdminGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // @UseGuards(OwnerOrAdminGuard)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  // @UseGuards(OwnerOrAdminGuard)
  @Delete(':id/deactive')
  @HttpCode(204)
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }
}
