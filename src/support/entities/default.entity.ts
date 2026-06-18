import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { uuidv7 } from 'uuidv7';

export abstract class IdEntity {
  @PrimaryColumn('uuid')
  id: string;

  // Sinh UUID v7 phía app cho luồng .save(); luồng .insert() dựa vào DEFAULT uuid_generate_v7() ở DB.
  @BeforeInsert()
  protected generateId() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
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
