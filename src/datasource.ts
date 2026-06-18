import { config as dotenvConfig } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenvConfig({ path: '.env' });

const config = {
  type: 'postgres',
  host: `${process.env.DB_HOST}`,
  port: Number(process.env.DB_PORT),
  username: `${process.env.DB_USERNAME}`,
  password: `${process.env.DB_PASSWORD}`,
  database: `${process.env.DB_DATABASE}`,
  entities: [
    process.env.NODE_ENV != 'local'
      ? 'main_dist/**/*.entity{.ts,.js}'
      : 'dist/**/*.entity{.ts,.js}',
  ],
  migrations: [
    process.env.NODE_ENV != 'local'
      ? 'main_dist/**/migrations/*{.ts,.js}'
      : 'dist/**/migrations/*{.ts,.js}',
  ],
  autoLoadEntities: true,
  synchronize: false,
};

export const dataSource = new DataSource(config as DataSourceOptions);
