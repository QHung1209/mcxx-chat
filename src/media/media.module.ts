import { Global, Module } from '@nestjs/common';
import { MediaEntity } from './entities/media.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './services/media.service';
import { UserMediaController } from './controllers/media.controller';
import { AccessController } from './controllers/access.controller';
import { ConfigModule } from '@nestjs/config';
import mediaConfig from './config/media.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [mediaConfig],
    }),
    TypeOrmModule.forFeature([MediaEntity]),
  ],
  controllers: [UserMediaController, AccessController],
  providers: [MediaRepository, MediaService],
  exports: [MediaRepository, MediaService],
})
export class MediaModule {}
