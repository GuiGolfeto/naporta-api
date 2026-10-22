import js from '@eslint/js';
import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';

/**
 * Configuração de lint do portal.
 *
 * Usa o preset oficial do Next (que já traz as regras de React e de
 * accessibility) combinado com as regras base do TypeScript.
 */
export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // O parser do Next não encaminha o `project service`, então regras que
      // exigem informações de tipo (como `consistent-type-imports`) não são
      // aplicadas aqui — elas ficam na configuração da raiz, para a API.
    },
  },
);
