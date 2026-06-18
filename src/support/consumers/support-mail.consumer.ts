import { MailerService } from '@nestjs-modules/mailer';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

@Processor('send-email-queue')
export class SupportMailConsumer extends WorkerHost {
  constructor(
    private mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super();
  }

  async process(job: Job<unknown>) {
    switch (job.name) {
      case 'forgot-password-job':
        await this.forgotPasswordJob(job);
        break;
    }
  }

  async forgotPasswordJob(job: Job) {
    const apiUrl = await this.configService.get('APP_URL');
    const feUrl = await this.configService.get('FE_URL');
    await this.mailerService.sendMail({
      to: job.data['user'].email,
      subject: this.i18n.t('base.FORGOT_PASSWORD'),
      template: `${this.configService.get('app.locale')}/forgot-password`,
      context: {
        name: job.data['user'].name,
        code: job.data['code'],
        apiUrl: apiUrl,
        feUrl: feUrl,
      },
    });
  }

}
