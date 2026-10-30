import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'char', length: 10, unique: true }) slug: string
  @Column({ type: 'uuid' }) ownerId: string
  @Column({ type: 'varchar', length: 80 }) name: string
  @Column({ type: 'text', nullable: true }) passwordHash: string | null
  @Column({ type: 'boolean', default: false }) requireApproval: boolean
  @Column({ type: 'boolean', default: false }) locked: boolean
  @Column({ type: 'varchar', length: 32, default: 'estimate' }) templateId: string
  @Column({ type: 'jsonb' }) config: unknown
  @Column({ type: 'jsonb', nullable: true }) liveState: unknown | null
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
