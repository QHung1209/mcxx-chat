import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { I18nService } from 'nestjs-i18n';
import { JwtAuthGuard } from '../../support/utils/jwt.guard';
import { MediaService } from '../services/media.service';
import {
  AclMediaDto,
  ActiveMediaDto,
  MediaDto,
  UploadMediaDto,
} from '../dto/media.dto';
import { MediaEntity } from '../entities/media.entity';

@Controller('media')
@UseGuards(new JwtAuthGuard('user'))
export class UserMediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly i18n: I18nService,
  ) {}

  private uploaderId(req: any): string {
    return req.user.id;
  }

  @Get()
  async findAll(@Query() dto: MediaDto, @Req() req: any) {
    if (!dto.page) dto.page = 1;
    if (!dto.limit) dto.limit = 20;
    const { total, results } = await this.mediaService.get(
      dto,
      this.uploaderId(req),
    );
    return {
      statusCode: 200,
      result: results,
      total,
      totalPages: Math.ceil(total / dto.limit),
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Req() req: any) {
    const media = await this.mediaService.detail(id, this.uploaderId(req));
    return { statusCode: 200, result: media };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file,
    @Req() req: any,
    @Body() body: UploadMediaDto,
  ) {
    if (!file) {
      throw new HttpException(
        {
          message: this.i18n.t('http.NOT_FOUND'),
          statusCode: HttpStatus.NOT_FOUND,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    const media = await this.mediaService.upload(file, {
      uploaderId: this.uploaderId(req),
      acl: body.acl,
    });
    return { statusCode: 200, result: media };
  }

  @Post('upload-stream')
  async uploadStream(@Req() req: any) {
    const media = await this.mediaService.uploadStream(req, {
      uploaderId: this.uploaderId(req),
    });
    return { statusCode: 200, result: media };
  }

  @Post('uploads')
  @UseInterceptors(FilesInterceptor('files'))
  async uploads(
    @UploadedFiles() files,
    @Req() req: any,
    @Body() body: UploadMediaDto,
  ) {
    const uploaderId = this.uploaderId(req);
    const medias: MediaEntity[] = [];
    for (const file of files) {
      medias.push(
        await this.mediaService.upload(file, { uploaderId, acl: body.acl }),
      );
    }
    return { statusCode: 200, result: medias };
  }

  @Put(':id/acl')
  async updateAcl(
    @Param('id') id: string,
    @Body() dto: AclMediaDto,
    @Req() req: any,
  ) {
    await this.mediaService.updateAcl(id, dto.acl, this.uploaderId(req));
    return { statusCode: 200 };
  }

  @Put(':id/active')
  async updateActive(
    @Param('id') id: string,
    @Body() dto: ActiveMediaDto,
    @Req() req: any,
  ) {
    await this.mediaService.updateActive(id, dto.isActive, this.uploaderId(req));
    return { statusCode: 200 };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.mediaService.delete(id, this.uploaderId(req));
    return { statusCode: 200 };
  }

  @Put(':id/put-back')
  async putBack(@Param('id') id: string, @Req() req: any) {
    await this.mediaService.putBack(id, this.uploaderId(req));
    return { statusCode: 200 };
  }

  @Delete(':id/forever')
  async deleteForever(@Param('id') id: string, @Req() req: any) {
    await this.mediaService.deleteForever(id, this.uploaderId(req));
    return { statusCode: 200 };
  }
}
