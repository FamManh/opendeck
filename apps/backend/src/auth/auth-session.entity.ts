import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryColumn({ type: 'char', length: 64 }) id: string   // sha256 hex của token trong cookie
  @Column({ type: 'uuid' }) userId: string
  @Column({ type: 'timestamptz' }) expiresAt: Date
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
