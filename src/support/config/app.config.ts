import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  locale: process.env.APP_LOCALE || 'en',
}));
