import { IsString, Matches } from 'class-validator';

export class VerifyCodeDto {
  @IsString()
  @Matches(/^\+[1-9]\d{10,14}$/, {
    message: 'Phone number must be in international format',
  })
  phoneNumber: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'Code must be 4 digits' })
  code: string;
}
