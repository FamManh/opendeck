import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity('password_resets')
export class PasswordReset {
  @PrimaryColumn({ type: 'char', length: 64 }) tokenHash: string
  @Column({ type: 'uuid' }) userId: string
  @Column({ type: 'timestamptz' }) expiresAt: Date
  @Column({ type: 'timestamptz', nullable: true }) usedAt: Date | null
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
