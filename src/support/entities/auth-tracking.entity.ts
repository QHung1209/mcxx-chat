import { Column, Entity } from 'typeorm';
import DefaultEntity from './default.entity';

const AUTH_TRACKING_TABLE_NAME = 'auth__tracking';

@Entity(AUTH_TRACKING_TABLE_NAME)
export class AuthTrackingEntity extends DefaultEntity {
  static TABLE_NAME = AUTH_TRACKING_TABLE_NAME;

  @Column()
  userId: number;

  @Column()
  scope: string;

  @Column()
  userAgent: string;

  @Column()
  ip: string;

  @Column()
  type: string;

  @Column('json')
  location: any;

  @Column('json')
  refreshToken: any;
}
