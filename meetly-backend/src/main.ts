import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Starting application...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

  try {
    // ← Измените тип на NestExpressApplication
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    app.enableCors({
      origin: true,
      credentials: true,
      exposedHeaders: ['Cache-Control', 'Expires', 'Pragma'],
    });

    // Отключаем кеширование глобально
    app.use((req, res, next) => {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Expires: '0',
        Pragma: 'no-cache',
      });
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Создаём папки для загрузок если не существуют
    const uploadsDir = join(__dirname, '..', 'uploads');
    for (const dir of ['avatars', 'events']) {
      const path = join(uploadsDir, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }

    app.useStaticAssets(uploadsDir, {
      prefix: '/uploads/',
    });

    app.setGlobalPrefix('api');

    const port = process.env.PORT || 3000;

    await app.listen(port, '0.0.0.0');

    console.log(`✓ Application successfully started on port ${port}`);
    console.log(
      `✓ Health check available at: http://0.0.0.0:${port}/api/health`,
    );
    console.log(`✓ API prefix: /api`);
    console.log(`✓ Static files served from: /uploads`);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
