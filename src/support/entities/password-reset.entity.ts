import { Column, Entity } from 'typeorm';
import { CreatedAtEntity } from './default.entity';

@Entity('password__resets')
export class PasswordResetEntity extends CreatedAtEntity {
  static TABLE_NAME = 'password__resets';

  @Column()
  email: string;

  @Column()
  code: string;

  @Column()
  scope: string;

  @Column()
  try: number;
}
