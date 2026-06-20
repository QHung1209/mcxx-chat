import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { IdentityModule } from './identity/identity.module';
import { SupportModule } from './support/support.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from './media/media.module';
import { ChatModule } from './chat/chat.module';
import appConfig from './support/config/app.config';
import { LoggerMiddleware } from './support/common/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    EventEmitterModule.forRoot({
      maxListeners: 0,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
          db: config.get('REDIS_INDEX'),
        },
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const configMail = {
          transport: {},
          defaults: {
            from: `"mcxx CHAT" <${config.getOrThrow<string>('MAIL_FROM')}>`,
          },
          template: {
            dir: join(__dirname, '../views/email'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
        if (config.get('MAIL_DRIVER') === 'SES') {
          const sesClient = new SESv2Client({
            region: config.get('AWS_REGION'),
            credentials: {
              accessKeyId: config.getOrThrow('AWS_ACCESS_KEY_ID'),
              secretAccessKey: config.getOrThrow('AWS_SECRET_ACCESS_KEY'),
            },
          });

          configMail['transport'] = {
            SES: {
              sesClient,
              SendEmailCommand,
            },
          };
        } else {
          configMail['transport'] = {
            host: config.get<string>('MAIL_HOST'),
            secure: false,
            auth: {
              user: config.get<string>('MAIL_USER'),
              pass: config.get<string>('MAIL_PASSWORD'),
            },
          };
        }
        return configMail;
      },
      inject: [ConfigService],
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: __dirname + '/i18n/',
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    SupportModule,
    MediaModule,
    IdentityModule,
    ChatModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
