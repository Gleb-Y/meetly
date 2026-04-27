import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtUserPayload } from '../auth/current-user.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { DeletePushTokenDto } from './dto/delete-push-token.dto';
import { PushTokensService } from './push-tokens.service';

@Controller('push-tokens')
@UseGuards(JwtAuthGuard)
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post('register')
  async register(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.pushTokensService.registerToken(
      user.id,
      dto.token,
      dto.platform,
    );
  }

  @Post('delete')
  async delete(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: DeletePushTokenDto,
  ) {
    return this.pushTokensService.deactivateToken(user.id, dto.token);
  }
}
