import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSubscriberDto {
  @IsIn(['email', 'webhook'])
  channel_type!: 'email' | 'webhook';

  @IsString()
  @MinLength(1)
  destination!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSubscriberDto {
  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
