import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { SupportMailConsumer } from './consumers/support-mail.consumer';
import { BaseAuthService } from './services/base-auth.service';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetEntity } from './entities/password-reset.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthTrackingRepository } from './repositories/auth-tracking.repository';
import { HttpModule } from '@nestjs/axios';
import { AuthTrackingEntity } from './entities/auth-tracking.entity';
import { RedisService } from './services/redis.service';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EventGateway } from './event.gateway';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([PasswordResetEntity, AuthTrackingEntity]),
    PassportModule.register({
      defaultStrategy: 'jwt',
      property: 'user',
      session: false,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('SECRETKEY'),
        signOptions: { expiresIn: config.get<number>('EXPIRESIN') },
      }),
    }),
    BullModule.registerQueue({ name: 'send-email-queue' }),
    HttpModule,
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        type: 'single',
        options: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
          db: config.get('REDIS_INDEX'),
        },
      }),
    }),
  ],
  controllers: [],
  providers: [
    SupportMailConsumer,
    JwtStrategy,
    EventGateway,

    PasswordResetRepository,
    AuthTrackingRepository,

    RedisService,
    BaseAuthService,
  ],
  exports: [
    BaseAuthService,
    AuthTrackingRepository,
    RedisService,
    EventGateway,
    JwtModule,
  ],
})
export class SupportModule {}
