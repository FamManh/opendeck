import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity('guests')
export class Guest {
  @PrimaryColumn({ type: 'char', length: 32 }) id: string
  @Column({ type: 'varchar', length: 40 }) name: string
  @Column({ type: 'varchar', length: 32 }) avatar: string
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date
}
