import { IsIn } from 'class-validator';

export class HandleReportDto {
  @IsIn(['ban', 'dismiss'])
  action: 'ban' | 'dismiss';
}
