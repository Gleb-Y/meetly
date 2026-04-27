import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  applyDecorators,
  Header,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { EventVisibility } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

interface OptionalAuthRequest extends Request {
  user?: { id: string };
}

const NoCache = () =>
  applyDecorators(
    Header('Cache-Control', 'no-store, no-cache, must-revalidate, private'),
    Header('Expires', '0'),
    Header('Pragma', 'no-cache'),
  );

const ALLOWED_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i;
const ALLOWED_MIME_TYPES = /\/(jpg|jpeg|png|webp|gif|heic|heif)$/;
const MAX_EVENT_PHOTOS = 10;

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('debug/raw')
  async debugRawEvents() {
    const [events, total, active, publicCount] = await Promise.all([
      this.prisma.event.findMany({ take: 10 }),
      this.prisma.event.count(),
      this.prisma.event.count({ where: { isActive: true } }),
      this.prisma.event.count({
        where: { isActive: true, visibility: EventVisibility.PUBLIC },
      }),
    ]);

    return { total, active, public: publicCount, events };
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-photo')
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
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    const photoUrl = await this.uploadService.uploadImage(file, 'events');
    return { photoUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-photos')
  @UseInterceptors(
    FilesInterceptor('files', MAX_EVENT_PHOTOS, {
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
  async uploadPhotos(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    if (files.length > MAX_EVENT_PHOTOS) {
      throw new BadRequestException(
        `Maximum ${MAX_EVENT_PHOTOS} photos are allowed`,
      );
    }

    const photoUrls = await Promise.all(
      files.map((file) => this.uploadService.uploadImage(file, 'events')),
    );
    return { photoUrls };
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-category-icon')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
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
  async uploadCategoryIcon(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    const iconUrl = await this.uploadService.uploadImage(
      file,
      'category-icons',
    );
    return { iconUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createEventDto: CreateEventDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.create(createEventDto, req.user.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @NoCache()
  findAll(
    @Query() queryDto: QueryEventsDto,
    @Request() req: OptionalAuthRequest,
  ) {
    return this.eventsService.findAll(queryDto, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @NoCache()
  getMyEvents(@Request() req: AuthenticatedRequest) {
    return this.eventsService.getMyEvents(req.user.id);
  }

  /**
   * POST /api/events/join-requests/:requestId/respond — принять/отклонить запрос
   * Body: { action: 'accept' | 'reject' }
   */
  @UseGuards(JwtAuthGuard)
  @Post('join-requests/:requestId/respond')
  respondToJoinRequest(
    @Param('requestId') requestId: string,
    @Body() body: { action: 'accept' | 'reject' },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.respondToJoinRequest(
      requestId,
      req.user.id,
      body.action,
    );
  }

  /**
   * DELETE /api/events/join-requests/:requestId — отменить свой запрос
   */
  @UseGuards(JwtAuthGuard)
  @Delete('join-requests/:requestId')
  cancelJoinRequest(
    @Param('requestId') requestId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.cancelJoinRequest(requestId, req.user.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @NoCache()
  findOne(@Param('id') id: string, @Request() req: OptionalAuthRequest) {
    return this.eventsService.getEventById(id, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.update(id, updateEventDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.eventsService.delete(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  join(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.eventsService.joinEvent(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  leave(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.eventsService.leaveEvent(id, req.user.id);
  }

  /**
   * POST /api/events/:id/kick — выгнать участника (только создатель)
   * Body: { userId: string }
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/kick')
  kick(
    @Param('id') id: string,
    @Body() body: { userId: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.kickParticipant(id, req.user.id, body.userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/participants')
  getParticipants(
    @Param('id') id: string,
    @Request() req: OptionalAuthRequest,
    @Query('forOrganizerCheckIn') forOrganizerCheckIn?: string,
  ) {
    return this.eventsService.getEventParticipants(
      id,
      req.user?.id,
      forOrganizerCheckIn === 'true',
    );
  }

  /**
   * GET /api/events/:id/join-requests — список запросов на вступление (для создателя)
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/join-requests')
  getJoinRequests(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.getEventJoinRequests(id, req.user.id);
  }

  /**
   * GET /api/events/:id/attendance — список посещаемости (для создателя)
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/attendance')
  getAttendance(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.eventsService.getEventAttendance(id, req.user.id);
  }

  /**
   * POST /api/events/:id/check-in — отметить/снять отметку присутствия (toggle)
   * Body: { userId: string }
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/check-in')
  toggleCheckIn(
    @Param('id') id: string,
    @Body() body: { userId: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.toggleCheckIn(id, req.user.id, body.userId);
  }

  /**
   * POST /api/events/:id/rate — оценить организатора (1-5)
   * Body: { score: number }
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/rate')
  rateOrganizer(
    @Param('id') id: string,
    @Body() body: { score: number },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventsService.rateOrganizer(id, req.user.id, body.score);
  }
}
