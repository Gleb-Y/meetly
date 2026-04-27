import { IsString, Matches } from 'class-validator';

export class SendCodeDto {
  @IsString()
  @Matches(/^\+[1-9]\d{10,14}$/, {
    message:
      'Phone number must be in international format (e.g., +79991234567)',
  })
  phoneNumber: string;
}
