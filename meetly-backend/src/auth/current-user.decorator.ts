import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUserPayload {
  id: string;
  phoneNumber?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Возвращаем весь user объект
  },
);
