import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isAccountBannedUnauthorized } from '../ban-payload';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /** Гость без токена — ok; битый токен — гость; забаненный с валидным JWT — пробрасываем 401. */
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Passport passes info, context, status
    ..._args: unknown[]
  ): TUser {
    if (err && isAccountBannedUnauthorized(err)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- Nest HttpException from Passport JWT
      throw err;
    }
    return user;
  }
}
