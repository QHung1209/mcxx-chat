import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class IdEntity {
  @PrimaryGeneratedColumn()
  id: number;
}

export abstract class CreatedAtEntity extends IdEntity {
  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}

export abstract class UpdatedAtEntity extends CreatedAtEntity {
  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}

export abstract class DeletedAtEntity extends UpdatedAtEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

export default abstract class DefaultEntity extends UpdatedAtEntity {}
