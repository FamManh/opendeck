import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'varchar', length: 254, unique: true }) email: string
  @Column({ type: 'text' }) passwordHash: string
  @Column({ type: 'varchar', length: 40 }) displayName: string
  @Column({ type: 'varchar', length: 32, nullable: true }) avatar: string | null
  @Column({ type: 'timestamptz', nullable: true }) emailVerifiedAt: Date | null
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
