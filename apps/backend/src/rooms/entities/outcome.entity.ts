import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('outcomes')
export class Outcome {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) itemId: string
  @Column({ type: 'varchar', length: 32 }) value: string
  @Column({ type: 'text', default: '' }) note: string
  @Column({ type: 'varchar', length: 64 }) decidedBy: string
  @Column({ type: 'timestamptz', default: () => 'now()' }) decidedAt: Date
}
