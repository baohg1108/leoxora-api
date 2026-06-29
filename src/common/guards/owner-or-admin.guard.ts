import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { JwtPayload } from '../../modules/auth/types/jwt-payload.type';

@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const targetId: string | undefined = request.params?.id;

    if (!user) {
      return false;
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (user.sub === targetId) {
      return true;
    }

    throw new ForbiddenException('You are not allowed to access this resource');
  }
}
