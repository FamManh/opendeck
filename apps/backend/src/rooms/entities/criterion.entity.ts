import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('criteria')
export class Criterion {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) roomId: string
  @Column({ type: 'varchar', length: 80 }) name: string
  @Column({ type: 'jsonb' }) scale: unknown
}
