import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { buildAccountBannedPayload } from '../ban-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phoneNumber: true, bannedUntil: true, banSource: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new UnauthorizedException(
        buildAccountBannedPayload(user.banSource, user.bannedUntil),
      );
    }

    return { id: user.id, phoneNumber: user.phoneNumber };
  }
}
