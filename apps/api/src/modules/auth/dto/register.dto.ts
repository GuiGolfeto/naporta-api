import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Limites da política de senha. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Política de senha: no mínimo 8 caracteres, com pelo menos uma letra e
 * um número. Expressa como regex para ser reaproveitada no DTO.
 */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, {
    message: 'A senha deve conter ao menos uma letra e um número.',
  })
  password!: string;
}
