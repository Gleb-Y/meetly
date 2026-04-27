import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtUserPayload } from '../auth/current-user.decorator';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  /**
   * POST /api/friends/request — Отправить запрос в друзья
   * Body: { receiverId: string }
   */
  @Post('request')
  async sendFriendRequest(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendsService.sendFriendRequest(user.id, dto.receiverId);
  }

  /**
   * POST /api/friends/request/:id/respond — Принять или отклонить запрос
   * Body: { action: 'accept' | 'reject' }
   */
  @Post('request/:id/respond')
  async respondToFriendRequest(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') requestId: string,
    @Body() dto: RespondFriendRequestDto,
  ) {
    if (dto.action === 'accept') {
      return this.friendsService.acceptFriendRequest(requestId, user.id);
    }
    return this.friendsService.rejectFriendRequest(requestId, user.id);
  }

  /**
   * DELETE /api/friends/request/:id — Отменить свой отправленный запрос
   */
  @Delete('request/:id')
  async cancelFriendRequest(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') requestId: string,
  ) {
    return this.friendsService.cancelFriendRequest(requestId, user.id);
  }

  /**
   * GET /api/friends — Получить список друзей
   */
  @Get()
  async getFriends(@CurrentUser() user: JwtUserPayload) {
    return this.friendsService.getFriends(user.id);
  }

  /**
   * GET /api/friends/requests/incoming — Входящие запросы (pending)
   */
  @Get('requests/incoming')
  async getIncomingRequests(@CurrentUser() user: JwtUserPayload) {
    return this.friendsService.getIncomingRequests(user.id);
  }

  /**
   * GET /api/friends/requests/outgoing — Исходящие запросы (pending)
   */
  @Get('requests/outgoing')
  async getOutgoingRequests(@CurrentUser() user: JwtUserPayload) {
    return this.friendsService.getOutgoingRequests(user.id);
  }

  /**
   * GET /api/friends/status/:userId — Проверить статус дружбы с пользователем
   */
  @Get('status/:userId')
  async getFriendshipStatus(
    @CurrentUser() user: JwtUserPayload,
    @Param('userId') targetUserId: string,
  ) {
    return this.friendsService.getFriendshipStatus(user.id, targetUserId);
  }

  /**
   * GET /api/friends/user/:userId — Друзья указанного пользователя (как GET /friends, с учётом приватности профиля)
   */
  @Get('user/:userId')
  async getFriendsOfUser(
    @CurrentUser() user: JwtUserPayload,
    @Param('userId') targetUserId: string,
  ) {
    return this.friendsService.getFriendsOfUser(user.id, targetUserId);
  }

  /**
   * GET /api/friends/mutual/:userId — Общие друзья с указанным пользователем
   */
  @Get('mutual/:userId')
  async getMutualFriends(
    @CurrentUser() user: JwtUserPayload,
    @Param('userId') targetUserId: string,
  ) {
    return this.friendsService.getMutualFriends(user.id, targetUserId);
  }

  /**
   * DELETE /api/friends/:friendId — Удалить из друзей
   */
  @Delete(':friendId')
  async removeFriend(
    @CurrentUser() user: JwtUserPayload,
    @Param('friendId') friendId: string,
  ) {
    return this.friendsService.removeFriend(user.id, friendId);
  }
}
