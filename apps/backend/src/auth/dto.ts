import { Transform } from 'class-transformer'
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class RegisterDto {
  @Transform(trim) @IsEmail() @MaxLength(254) email: string
  @IsString() @Length(8, 200) password: string
  @Transform(trim) @IsString() @Length(1, 40) displayName: string
  @IsOptional() @Transform(trim) @IsString() @Length(1, 32) avatar?: string
}

export class UpdateMeDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 40) displayName?: string
  @IsOptional() @Transform(trim) @IsString() @Length(1, 32) avatar?: string
}

export class LoginDto {
  @Transform(trim) @IsEmail() email: string
  @IsString() @MaxLength(200) password: string
}
