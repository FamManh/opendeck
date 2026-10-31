import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator'
import { PRESET_SCALES, SPECIAL_IDS, TIMER_MAX_SEC, type SpecialId } from '../../domain'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CustomScaleDto {
  @Transform(trim) @IsString() @Length(1, 40) name: string
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(16, { each: true }) labels: string[]
}

export class RevealRuleDto {
  @IsBoolean() onAllVoted: boolean
  @ValidateIf((_o, v) => v !== null) @IsInt() @Min(1) @Max(TIMER_MAX_SEC) timerSec: number | null
}

export class CreateRoomDto {
  @Transform(trim) @IsString() @Length(1, 80) name: string
  @IsOptional() @IsIn(Object.keys(PRESET_SCALES)) scaleId?: keyof typeof PRESET_SCALES
  @IsOptional() @ValidateNested() @Type(() => CustomScaleDto) customScale?: CustomScaleDto
  @IsOptional() @IsArray() @IsIn(SPECIAL_IDS, { each: true }) enabledSpecials?: SpecialId[]
  @IsOptional() @IsString() @Length(1, 128) password?: string
  @IsOptional() @IsBoolean() requireApproval?: boolean
  @IsOptional() @ValidateNested() @Type(() => RevealRuleDto) revealRule?: RevealRuleDto
}
