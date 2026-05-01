import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export type UploadFolder =
  | 'avatars'
  | 'events'
  | 'chat'
  | 'chat-audio'
  | 'category-icons';

@Injectable()
export class UploadService {
  private useCloudinary: boolean;
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Проверяем доступны ли Cloudinary данные
    this.useCloudinary =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;

    if (this.useCloudinary) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      console.log('✅ Cloudinary настроена');
    } else {
      console.log(
        '⚠️  Cloudinary не настроена. Файлы будут сохранены локально в /uploads/',
      );
      // Создаем директорию uploads если её нет
      this.ensureUploadsDir();
    }
  }

  private ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<string> {
    if (!file) throw new BadRequestException('No file provided');

    // Если Cloudinary настроена - используем её
    if (this.useCloudinary) {
      return this.uploadToCloudinary(file, folder);
    } else {
      // Иначе сохраняем локально
      return this.uploadLocally(file, folder);
    }
  }

  private uploadToCloudinary(
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `meetly/${folder}`,
          resource_type: 'image',
          transformation:
            folder === 'avatars'
              ? [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
              : folder === 'category-icons'
                ? [
                    {
                      width: 256,
                      height: 256,
                      crop: 'fill',
                      quality: 'auto',
                    },
                  ]
                : folder === 'chat'
                  ? [
                      {
                        width: 1600,
                        height: 1600,
                        crop: 'limit',
                        quality: 'auto',
                      },
                    ]
                  : [
                      {
                        width: 1200,
                        height: 800,
                        crop: 'limit',
                        quality: 'auto',
                      },
                    ],
        },
        (error, result: UploadApiResponse) => {
          if (error) return reject(new BadRequestException(error.message));
          resolve(result.secure_url);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  private uploadLocally(
    file: Express.Multer.File,
    folder: UploadFolder,
  ): string {
    // Создаем папку для типа файлов если её нет
    const folderPath = path.join(this.uploadsDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Генерируем уникальное имя файла
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(folderPath, filename);

    // Сохраняем файл
    fs.writeFileSync(filepath, file.buffer);

    // Возвращаем URL локального файла
    // Например: /uploads/avatars/uuid.jpg
    // Это должно быть доступно через static маршрут
    return `/uploads/${folder}/${filename}`;
  }

  async uploadAudio(
    file: Express.Multer.File,
    folder: Extract<UploadFolder, 'chat-audio'> = 'chat-audio',
  ): Promise<string> {
    if (!file) throw new BadRequestException('No file provided');

    if (this.useCloudinary) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `meetly/${folder}`,
            resource_type: 'video',
          },
          (error, result: UploadApiResponse) => {
            if (error) return reject(new BadRequestException(error.message));
            resolve(result.secure_url);
          },
        );

        Readable.from(file.buffer).pipe(uploadStream);
      });
    } else {
      return this.uploadLocally(file, folder);
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    if (this.useCloudinary) {
      await cloudinary.uploader.destroy(publicId);
    } else {
      // Удаляем локальный файл
      // publicId может быть /uploads/avatars/uuid.jpg
      const filepath = path.join(process.cwd(), publicId);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
  }
}
