import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { Role } from '../../../generated/prisma/client.js';

/** Filtros da listagem de usuários. */
export class UserQueryDto {
  /** Filtro parcial por e-mail. */
  @IsOptional()
  @IsString()
  @MaxLength(180)
  email?: string;

  /** Filtro por papel. */
  @IsOptional()
  @IsEnum(Role, { message: 'Papel inválido.' })
  role?: Role;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'A página deve ser um número inteiro.' })
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value)))
  @IsInt({ message: 'O limite deve ser um número inteiro.' })
  @Min(1)
  @Max(100)
  limit?: number;
}
