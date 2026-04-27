import { Module, Global } from '@nestjs/common';
import { SmsService } from './sms.service';
import { TelegramGatewayService } from './telegram-gateway.service';

@Global()
@Module({
  providers: [SmsService, TelegramGatewayService],
  exports: [SmsService, TelegramGatewayService],
})
export class SmsModule {}
