import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtUserPayload } from '../auth/current-user.decorator';

// ─── Avatar upload config ─────────────────────────────────────────────────────

const ALLOWED_IMAGE_MIME = /\/(jpg|jpeg|png|webp|gif|heic|heif)$/;
const ALLOWED_IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const avatarUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const isValidMime = ALLOWED_IMAGE_MIME.test(file.mimetype);
    const isOctetWithValidExt =
      file.mimetype === 'application/octet-stream' &&
      ALLOWED_IMAGE_EXT.test(file.originalname);

    if (!isValidMime && !isOctetWithValidExt) {
      return cb(
        new BadRequestException(`Unsupported file type: ${file.mimetype}`),
        false,
      );
    }
    cb(null, true);
  },
});

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /** GET /users/search?q=&limit= */
  @Get('search')
  async searchUsers(@Query('q') query: string, @Query('limit') limit?: string) {
    if (!query?.trim() || query.trim().length < 2) return [];
    return this.usersService.searchByUsername(
      query.trim(),
      parseInt(limit ?? '10', 10),
    );
  }

  /** GET /users/me */
  @Get('me')
  async getMyProfile(@CurrentUser() user: JwtUserPayload) {
    return this.usersService.getMyProfile(user.id);
  }

  /** POST /users/me/avatar */
  @Post('me/avatar')
  @UseInterceptors(avatarUploadInterceptor)
  async uploadAvatar(
    @CurrentUser() user: JwtUserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const avatarUrl = await this.uploadService.uploadImage(file, 'avatars');

    // Если это локальный файл, конвертируем в полный URL
    const fullAvatarUrl = avatarUrl.startsWith('http')
      ? avatarUrl
      : `${process.env.API_URL || 'http://192.168.1.16:3000'}${avatarUrl}`;

    const { id, username, avatar, bio, age, interests } =
      await this.prisma.user.update({
        where: { id: user.id },
        data: { avatar: fullAvatarUrl },
        select: {
          id: true,
          username: true,
          avatar: true,
          bio: true,
          age: true,
          interests: true,
        },
      });

    return { id, username, avatar, bio, age, interests, avatarUrl: avatar };
  }

  /** GET /users/:userId */
  @Get(':userId')
  async getUserProfile(
    @Param('userId') userId: string,
    @CurrentUser() viewer: JwtUserPayload,
  ) {
    return this.usersService.findById(userId, viewer.id);
  }
}
