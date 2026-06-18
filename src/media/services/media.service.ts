import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { In, LessThanOrEqual } from 'typeorm';
import { MediaRepository } from '../repositories/media.repository';
import { MediaDto } from '../dto/media.dto';
import { ConfigService } from '@nestjs/config';
import { convertSlug } from '../../support/common/convertStringRegex';
import { DateTime } from 'luxon';
import { I18nService } from 'nestjs-i18n';
import Busboy from '@fastify/busboy';
import { Request } from 'express';
import { PassThrough } from 'stream';
import { MediaEntity } from '../entities/media.entity';

@Injectable()
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  getLinkMediaKey(key: string, acl = false) {
    if (acl) {
      return `https://${this.configService.get(
        'AWS_PUBLIC_BUCKET_NAME',
      )}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
    }
    const command = new GetObjectCommand({
      Bucket: this.configService.get('AWS_PUBLIC_BUCKET_NAME'),
      Key: key,
    });
    return getSignedUrl(this.getS3(), command, {
      expiresIn: 60 * 60 * 12,
    });
  }

  async get(dto: MediaDto, uploaderId?: number) {
    const qb = this.mediaRepository.createQueryBuilder();
    if (uploaderId) {
      qb.andWhere('uploaderId = :uploaderId', { uploaderId });
    }
    if (typeof dto.active != 'undefined') {
      qb.andWhere('isActive = :isActive', { isActive: !!dto.active });
    }
    if (dto.delete) {
      qb.andWhere('deletedAt is not null');
      qb.orderBy('deletedAt', 'DESC');
    } else {
      qb.orderBy('id', 'DESC');
    }
    if (dto.type) {
      qb.andWhere('mimeType like :type', { type: dto.type + '%' });
    }
    if (dto.search) {
      qb.andWhere('name like :search', { search: '%' + dto.search + '%' });
    }
    const [results, total] = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getManyAndCount();
    return {
      results: await Promise.all(
        results.map(async (el) => {
          if (!el.acl) {
            el.url = await this.getLinkMediaKey(el.key, el.acl);
          }
          return el;
        }),
      ),
      total,
    };
  }

  async detail(id: number, uploaderId?: number) {
    const media = await this.mediaRepository.findOneBy(
      uploaderId ? { id, uploaderId } : { id },
    );
    if (!media) {
      throw new HttpException(
        {
          message: this.i18n.t('http.NOT_FOUND'),
          statusCode: HttpStatus.NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    if (!media.acl) {
      media.url = await this.getLinkMediaKey(media.key, media.acl);
    }
    return media;
  }

  async upload(file, { uploaderId, acl }: { uploaderId: number; acl: boolean }) {
    const timestamp = Math.floor(
      DateTime.local().setZone('Asia/Ho_Chi_Minh').toSeconds(),
    );
    const id = 'replaceId_' + timestamp;
    const arrName = file.originalname.split('.');
    const originalName = Buffer.from(file.originalname, 'latin1').toString(
      'utf-8',
    );

    arrName.pop();
    const name = arrName.join('.');

    let key =
      id +
      `/${uploaderId}-${timestamp}-size/` +
      convertSlug(name) +
      '.' +
      file.originalname.split('.').pop();

    const media = await this.mediaRepository.save({
      uploaderId,
      name: name,
      fileName: originalName,
      disk: this.configService.get('FILESYSTEM_DRIVER') ?? 's3',
      mimeType: file.mimetype,
      size: file.size,
      key: key,
      url: '#',
      isActive: true,
      acl: acl,
    });
    key = key.replace(id, String(media.id));
    await this.mediaRepository.update(media.id, {
      key: key,
      url: await this.getLinkMediaKey(key, true),
    });

    media.key = key;
    media.url = await this.getLinkMediaKey(key, acl);

    await this.uploadS3(file.buffer, key, file.mimetype, acl ?? false);
    return media;
  }

  async uploadStream(req: Request, { uploaderId }: { uploaderId: number }) {
    return new Promise<MediaEntity>((resolve, reject) => {
      const busboy = new Busboy({ headers: req.headers } as any);
      let mediaPromise: Promise<MediaEntity> | null = null;

      busboy.on(
        'file',
        (fieldname, fileStream, filename, _encoding, mimetype) => {
          if (fieldname !== 'file') {
            fileStream.resume();
            return;
          }

          mediaPromise = (async () => {
            const timestamp = Math.floor(
              DateTime.local().setZone('Asia/Ho_Chi_Minh').toSeconds(),
            );
            const placeholder = 'replaceId_' + timestamp;
            const originalName = Buffer.from(filename, 'latin1').toString(
              'utf-8',
            );
            const arrName = filename.split('.');
            const ext = arrName.pop();
            const name = arrName.join('.');

            let key =
              placeholder +
              `/${uploaderId}-${timestamp}-size/` +
              convertSlug(name) +
              '.' +
              ext;

            const media = await this.mediaRepository.save({
              uploaderId,
              name,
              fileName: originalName,
              disk: this.configService.get('FILESYSTEM_DRIVER') ?? 's3',
              mimeType: mimetype,
              size: 0,
              key,
              url: '#',
              isActive: true,
              acl: true,
            });

            key = key.replace(placeholder, String(media.id));

            const counter = new PassThrough();
            let bytes = 0;
            counter.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
            });
            fileStream.pipe(counter);

            try {
              const uploader = new Upload({
                client: this.getS3(),
                params: {
                  Bucket: this.configService.getOrThrow(
                    'AWS_PUBLIC_BUCKET_NAME',
                  ),
                  Key: key,
                  Body: counter,
                  ContentType: mimetype,
                  ACL: 'public-read',
                },
                queueSize: 4,
                partSize: 5 * 1024 * 1024,
                leavePartsOnError: false,
              });
              await uploader.done();
            } catch (err) {
              await this.mediaRepository.delete(media.id);
              throw err;
            }

            const url = await this.getLinkMediaKey(key, true);
            await this.mediaRepository.update(media.id, {
              key,
              url,
              size: bytes,
            });

            media.key = key;
            media.url = url;
            media.size = bytes;
            return media;
          })();
        },
      );

      busboy.on('finish', async () => {
        try {
          if (!mediaPromise) {
            return reject(new HttpException('No file uploaded', 400));
          }
          resolve(await mediaPromise);
        } catch (error: any) {
          reject(new HttpException(error?.message || 'Upload failed', 400));
        }
      });

      busboy.on('error', (error: any) => {
        reject(
          new HttpException(error?.message || error || 'Upload failed', 400),
        );
      });

      req.pipe(busboy);
    });
  }

  async updateAcl(id: number, acl: boolean, uploaderId?: number) {
    const media = await this.mediaRepository.findOneBy(
      uploaderId ? { id, uploaderId } : { id },
    );
    if (media && acl != media.acl) {
      await this.mediaRepository.update(id, { acl: acl });
    }
  }

  async updateActive(id: number, isActive: boolean, uploaderId?: number) {
    const media = await this.mediaRepository.findOneBy(
      uploaderId ? { id, uploaderId } : { id },
    );
    if (media && media.isActive != isActive) {
      await this.mediaRepository.update(id, { isActive });
    }
  }

  async delete(id: number, uploaderId?: number) {
    const media = await this.mediaRepository.findOneBy(
      uploaderId ? { id, uploaderId } : { id },
    );
    if (media && !media.deletedAt) {
      await this.mediaRepository.softDelete(id);
    }
  }

  async putBack(id: number, uploaderId?: number) {
    const media = await this.mediaRepository.findOne({
      where: uploaderId ? { id, uploaderId } : { id },
      withDeleted: true,
    });
    if (media && media.deletedAt) {
      await this.mediaRepository.restore(id);
    }
  }

  async deleteForever(id: number, uploaderId?: number) {
    const media = await this.mediaRepository.findOne({
      where: uploaderId ? { id, uploaderId } : { id },
      withDeleted: true,
    });
    if (media && media.deletedAt) {
      await this.mediaRepository.delete(id);
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.configService.get('AWS_PUBLIC_BUCKET_NAME'),
        Key: media.key,
      });
      await this.getS3().send(deleteCommand);
    }
  }

  async getFileDeleteMonthAgo() {
    const startDate = DateTime.local()
      .setZone(this.configService.get('APP_ZONE'))
      .minus({ months: 1 })
      .startOf('day');
    return this.mediaRepository.find({
      where: {
        deletedAt: LessThanOrEqual(new Date(startDate.toString())),
      },
      withDeleted: true,
    });
  }

  async uploadS3(fileBuffer, key, contentType, acl = false) {
    const params: PutObjectCommandInput = {
      Bucket: this.configService.getOrThrow('AWS_PUBLIC_BUCKET_NAME'),
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: acl ? 'public-read' : 'private',
    };
    const s3 = this.getS3();
    const uploadCommand = new PutObjectCommand(params);
    return s3.send(uploadCommand);
  }

  getS3(): S3Client {
    return new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  // Lấy danh sách media theo id, giới hạn trong các file của chính user.
  async getByIdsUser(ids: number[], userId: number) {
    if (!ids?.length) return [];
    return this.mediaRepository.find({
      where: {
        id: In(ids),
        uploaderId: userId,
      },
    });
  }

  async getByIds(ids: number[]) {
    if (!ids?.length) return [];
    return this.mediaRepository.findBy({ id: In(ids) });
  }

  // Gán media (avatar) vào danh sách record dựa trên cột id (mặc định avatarMediaId).
  // Dùng cho user/chat: record[as] = MediaEntity tương ứng (hoặc null).
  async attachAvatar(
    records: any[],
    idField = 'avatarMediaId',
    as = 'avatar',
  ) {
    if (!records?.length) return records;
    const ids = [
      ...new Set(records.map((r) => r?.[idField]).filter(Boolean)),
    ] as number[];
    if (!ids.length) {
      records.forEach((r) => {
        if (r) r[as] = null;
      });
      return records;
    }
    const medias = await this.getByIds(ids);
    await Promise.all(
      medias.map(async (m) => {
        if (!m.acl) m.url = await this.getLinkMediaKey(m.key, false);
      }),
    );
    const map = new Map(medias.map((m) => [m.id, m]));
    records.forEach((r) => {
      if (r) r[as] = r[idField] ? map.get(r[idField]) ?? null : null;
    });
    return records;
  }
}
