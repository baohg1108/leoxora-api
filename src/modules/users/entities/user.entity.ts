import {
  PrimaryGeneratedColumn,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Column,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserLevel } from '../../../common/enums/user-level.enum';
import { UserRole } from '../../../common/enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Login Info
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Exclude()
  @Column({ name: 'pass_hash', type: 'varchar', nullable: false })
  passwordHash!: string;

  // About Info
  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string;

  // Role Info
  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role!: UserRole;

  @Column({ name: 'user_level', type: 'enum', enum: UserLevel, nullable: true })
  userLevel!: UserLevel | null;

  // Status Activity Info
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  // Gamification Info
  @Column({ name: 'streak_count', type: 'int', default: 0 })
  streakCount!: number;

  @Column({ name: 'last_active', type: 'timestamptz', nullable: true })
  lastActive!: Date | null;

  // Audit Log
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
