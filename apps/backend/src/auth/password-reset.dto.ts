import { Transform } from 'class-transformer'
import { IsEmail, IsString, Length } from 'class-validator'

export class ForgotDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsEmail() email: string
}

export class ResetDto {
  @IsString() @Length(1, 200) token: string
  @IsString() @Length(8, 200) password: string
}
