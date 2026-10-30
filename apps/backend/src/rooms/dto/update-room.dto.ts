import { IsBoolean, IsOptional, IsString, Length } from 'class-validator'

export class UpdateRoomDto {
  /** Chuỗi = đặt mật khẩu mới; null = gỡ mật khẩu; bỏ qua = giữ nguyên. */
  @IsOptional() @IsString() @Length(1, 128) password?: string | null
  @IsOptional() @IsBoolean() locked?: boolean
  @IsOptional() @IsBoolean() requireApproval?: boolean
}

export class JoinRoomDto {
  @IsOptional() @IsString() @Length(0, 128) password?: string
}
