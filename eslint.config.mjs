import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      // Proibir `any` explícito — garante tipagem forte em todo o projeto
      '@typescript-eslint/no-explicit-any': 'error',
      // Exigir tipos de retorno explícitos em funções exportadas
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Proibir variáveis declaradas e não usadas
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Prefere const sobre let quando não há reatribuição
      'prefer-const': 'error',
      // Proibir console.log em produção (usar o sistema de log interno)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]

export default eslintConfig
