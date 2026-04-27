import { IsIn, IsNotEmpty } from 'class-validator';

export class RespondFriendRequestDto {
  @IsNotEmpty()
  @IsIn(['accept', 'reject'])
  action: 'accept' | 'reject';
}
