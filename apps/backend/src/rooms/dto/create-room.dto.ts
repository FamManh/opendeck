import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength, ValidateNested } from 'class-validator'
import { PRESET_SCALES, SPECIAL_IDS, type SpecialId } from '../../domain'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CustomScaleDto {
  @Transform(trim) @IsString() @Length(1, 40) name: string
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(16, { each: true }) labels: string[]
}

export class CreateRoomDto {
  @Transform(trim) @IsString() @Length(1, 80) name: string
  @IsOptional() @IsIn(Object.keys(PRESET_SCALES)) scaleId?: keyof typeof PRESET_SCALES
  @IsOptional() @ValidateNested() @Type(() => CustomScaleDto) customScale?: CustomScaleDto
  @IsOptional() @IsArray() @IsIn(SPECIAL_IDS, { each: true }) enabledSpecials?: SpecialId[]
  @IsOptional() @IsString() @Length(1, 128) password?: string
  @IsOptional() @IsBoolean() requireApproval?: boolean
}
