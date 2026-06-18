import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import DefaultEntity from 'src/support/entities/default.entity';
import { Exclude } from 'class-transformer';
import { ChatMember } from 'src/chat/entities/member.entity';
import { Message } from 'src/chat/entities/message.entity';
import { Reaction } from 'src/chat/entities/reaction.entity';
import { MediaEntity } from 'src/media/entities/media.entity';

@Entity('identity__users')
export class User extends DefaultEntity {
  static TABLE_NAME = 'identity__users';

  @Column({ type: 'varchar', nullable: false, length: 255 })
  email: string;

  @Column({ type: 'varchar', nullable: false, length: 255 })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  googleId: string;

  @Column({ type: 'uuid', nullable: true })
  avatarMediaId: string | null;

  @ManyToOne(() => MediaEntity, { nullable: true })
  @JoinColumn({ name: 'avatarMediaId' })
  avatar: MediaEntity | null;

  @Column({ type: 'varchar', nullable: false, length: 255 })
  @Exclude()
  password: string;

  @Column()
  isActive: boolean;

  @OneToMany(() => ChatMember, (chatMember) => chatMember.user)
  chatMembers: ChatMember[];

  @OneToMany(() => Message, (message) => message.sender)
  messages: Message[];

  @OneToMany(() => Reaction, (reaction) => reaction.user)
  reactions: Reaction[];
}
