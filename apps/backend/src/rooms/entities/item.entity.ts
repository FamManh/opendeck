import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({ type: 'uuid' }) roomId: string
  @Column({ type: 'varchar', length: 16, default: 'manual' }) source: string
  @Column({ type: 'varchar', length: 64, nullable: true }) externalRef: string | null
  @Column({ type: 'text' }) title: string
  @Column({ type: 'text', default: '' }) description: string
  @Column({ type: 'integer' }) order: number
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status: string
}
