import { Transform } from 'class-transformer'
import { IsOptional, IsString, Length } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CreateGuestDto {
  @Transform(trim) @IsString() @Length(1, 40) name: string
  @Transform(trim) @IsString() @Length(1, 32) avatar: string
}

export class UpdateGuestDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 40) name?: string
  @IsOptional() @Transform(trim) @IsString() @Length(1, 32) avatar?: string
}
