import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ArrayNotEmpty,
  IsNotEmpty,
} from 'class-validator';
import {
  ChatService,
  DeletedMessageResult,
  EditedMessageResult,
  MessageWithDetails,
} from './chat.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtUserPayload } from '../auth/current-user.decorator';

export { MessageWithDetails };

const ALLOWED_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;
const ALLOWED_MIME_TYPES = /\/(jpg|jpeg|png|webp|gif|heic|heif)$/;
const ALLOWED_AUDIO_EXTENSIONS = /\.(m4a|aac|mp4)$/i;
const ALLOWED_AUDIO_MIME_TYPES =
  /^(audio\/mp4|audio\/aac|audio\/x-aac|audio\/x-m4a)$/i;

class SendMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(60_000)
  audioDurationMs?: number;

  @IsOptional()
  @IsString()
  audioMimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15 * 1024 * 1024)
  audioSizeBytes?: number;
}

class ReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

class MarkReadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  messageIds: string[];
}

class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

class UpdateChatMuteDto {
  @IsBoolean()
  isMuted: boolean;
}

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * POST /api/chats/:chatId/upload-image — загрузить фото для сообщения в чате
   */
  @Post(':chatId/upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const isValidMime = ALLOWED_MIME_TYPES.test(file.mimetype);
        const isValidOctet =
          file.mimetype === 'application/octet-stream' &&
          ALLOWED_IMAGE_EXTENSIONS.test(file.originalname);

        if (!isValidMime && !isValidOctet) {
          return callback(
            new BadRequestException(
              `Only image files are allowed. Got: ${file.mimetype}`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @Param('chatId') chatId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUserPayload,
  ) {
    await this.chatService.getChatByIdChecked(chatId, user.id);
    if (!file) throw new BadRequestException('No file uploaded');

    const imageUrl = await this.uploadService.uploadImage(file, 'chat');
    return { imageUrl };
  }

  /**
   * POST /api/chats/:chatId/upload-audio — загрузить аудио для голосового сообщения
   */
  @Post(':chatId/upload-audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const isValidMime = ALLOWED_AUDIO_MIME_TYPES.test(file.mimetype);
        const isValidOctet =
          file.mimetype === 'application/octet-stream' &&
          ALLOWED_AUDIO_EXTENSIONS.test(file.originalname);

        if (!isValidMime && !isValidOctet) {
          return callback(
            new BadRequestException(
              `Only AAC/M4A audio files are allowed. Got: ${file.mimetype}`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadAudio(
    @Param('chatId') chatId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUserPayload,
  ) {
    await this.chatService.getChatByIdChecked(chatId, user.id);
    if (!file) throw new BadRequestException('No file uploaded');

    const audioUrl = await this.uploadService.uploadAudio(file, 'chat-audio');
    return { audioUrl };
  }

  /**
   * GET /api/chats - список всех чатов пользователя
   */
  @Get()
  getUserChats(@CurrentUser() user: JwtUserPayload) {
    return this.chatService.getUserChats(user.id);
  }

  /**
   * GET /api/chats/unread/total - общее количество непрочитанных
   */
  @Get('unread/total')
  async getTotalUnreadCount(@CurrentUser() user: JwtUserPayload) {
    const count = await this.chatService.getTotalUnreadCount(user.id);
    return { count };
  }

  /**
   * GET /api/chats/:chatId/mute - статус mute для текущего пользователя
   */
  @Get(':chatId/mute')
  async getChatMuteStatus(
    @Param('chatId') chatId: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.getChatMuteStatus(chatId, user.id);
  }

  /**
   * PUT /api/chats/:chatId/mute - включить/выключить mute для текущего пользователя
   */
  @Put(':chatId/mute')
  async setChatMuteStatus(
    @Param('chatId') chatId: string,
    @Body() body: UpdateChatMuteDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.setChatMuteStatus(chatId, user.id, body.isMuted);
  }

  /**
   * GET /api/chats/:chatId - получить чат с сообщениями.
   * У каждого сообщения `reactions[]`: `emoji`, `count`, `userIds`, `hasReacted`,
   * и `reactors[]` — `{ id, username, avatar }` для аватарок (порядок по userId).
   */
  @Get(':chatId')
  getChat(
    @Param('chatId') chatId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.getChat(chatId, user.id, limit);
  }

  /**
   * GET /api/chats/:chatId/messages - сообщения с cursor.
   * Формат `reactions[]` как в GET чата: есть `reactors[]` с превью пользователей.
   */
  @Get(':chatId/messages')
  async getMessages(
    @Param('chatId') chatId: string,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('direction') direction: 'older' | 'newer' | undefined,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.getMessages(
      chatId,
      user.id,
      limit ? parseInt(limit, 10) : 50,
      cursor,
      direction || 'older',
    );
  }

  /**
   * POST /api/chats/:chatId/messages - отправить сообщение
   */
  @Post(':chatId/messages')
  sendMessage(
    @Param('chatId') chatId: string,
    @Body() body: SendMessageDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.sendMessage(
      chatId,
      user.id,
      body.content ?? '',
      body.replyToId,
      body.imageUrl,
      body.audioUrl,
      body.audioDurationMs,
      body.audioMimeType,
      body.audioSizeBytes,
    );
  }

  /**
   * POST /api/chats/:chatId/read - отметить все как прочитанные
   */
  @Post(':chatId/read')
  @HttpCode(HttpStatus.OK)
  async markChatAsRead(
    @Param('chatId') chatId: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.markChatAsRead(chatId, user.id);
  }

  /**
   * POST /api/chats/messages/read - отметить конкретные сообщения как прочитанные
   */
  @Post('messages/read')
  @HttpCode(HttpStatus.OK)
  async markMessagesAsRead(
    @Body() body: MarkReadDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.markMessagesAsRead(body.messageIds, user.id);
  }

  /**
   * GET /api/chats/:chatId/unread - количество непрочитанных в чате
   */
  @Get(':chatId/unread')
  async getUnreadCount(
    @Param('chatId') chatId: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const count = await this.chatService.getUnreadCount(chatId, user.id);
    return { count };
  }

  /**
   * POST /api/chats/messages/:messageId/reactions — toggle/replace реакции.
   * Ответ: `{ action: 'added'|'removed'|'replaced', reaction: { emoji, userId, user: { id, username, avatar } }, previousEmoji? }`.
   */
  @Post('messages/:messageId/reactions')
  @HttpCode(HttpStatus.OK)
  toggleReaction(
    @Param('messageId') messageId: string,
    @Body() { emoji }: ReactionDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.toggleReaction(messageId, user.id, emoji);
  }

  /**
   * GET /api/chats/messages/:messageId/reactions — плоский список строк реакций из БД;
   * у каждой записи вложенный `user: { id, username, avatar }`. Доступ только участникам чата.
   */
  @Get('messages/:messageId/reactions')
  async getMessageReactions(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.getMessageReactions(messageId, user.id);
  }

  /**
   * PATCH /api/chats/messages/:messageId — отредактированное сообщение;
   * `reactions[]` с `reactors[]` в том же формате, что и в ленте сообщений.
   */
  @Patch('messages/:messageId')
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() body: EditMessageDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<EditedMessageResult> {
    return await this.chatService.editMessage(messageId, user.id, body.content);
  }

  /**
   * DELETE /api/chats/messages/:messageId - удалить сообщение
   */
  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<DeletedMessageResult> {
    return await this.chatService.deleteMessage(messageId, user.id);
  }

  /**
   * GET /api/chats/event/:eventId - получить чат по событию
   */
  @Get('event/:eventId')
  async getChatByEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.chatService.getChatByEventId(eventId, user.id);
  }

  /**
   * GET /api/chats/event/:eventId/unread - количество непрочитанных по событию
   * @deprecated используй GET /api/chats/:chatId/unread
   */
  @Get('event/:eventId/unread')
  async getUnreadCountByEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const chat = await this.chatService.getChatByEventId(eventId, user.id);
    const count = await this.chatService.getUnreadCount(chat.id, user.id);
    return { count };
  }
}
