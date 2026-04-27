import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export type UploadFolder =
  | 'avatars'
  | 'events'
  | 'chat'
  | 'chat-audio'
  | 'category-icons';

@Injectable()
export class UploadService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<string> {
    if (!file) throw new BadRequestException('No file provided');

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

  async uploadAudio(
    file: Express.Multer.File,
    folder: Extract<UploadFolder, 'chat-audio'> = 'chat-audio',
  ): Promise<string> {
    if (!file) throw new BadRequestException('No file provided');

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
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
