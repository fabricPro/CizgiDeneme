import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Büyük harfli sabitler, kullanılmayan yakalanan hata değişkenleri ve bilinçli
      // tutulan (kaynaktan gelen) yardımcılar için hata değil uyarı yeter.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none', args: 'none' }],
      // Önizleme imleci için drag.current render sırasında okunuyor (kasıtlı, zararsız).
      'react-hooks/refs': 'warn',
    },
  },
])
