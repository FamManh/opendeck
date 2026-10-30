import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm'

@Entity('votes')
@Unique(['itemId', 'criterionId', 'participantKey', 'round'])
export class Vote {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) itemId: string
  @Column({ type: 'uuid' }) criterionId: string
  @Column({ type: 'varchar', length: 64 }) participantKey: string
  @Column({ type: 'integer' }) round: number
  @Column({ type: 'varchar', length: 32 }) cardId: string
  @Column({ type: 'boolean', default: false }) anonymous: boolean
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
