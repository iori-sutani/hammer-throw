import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended, // ESLint 標準ルール
      tseslint.configs.recommended, // TypeScript ESLint 標準ルール (any禁止など)
      reactHooks.configs.flat.recommended, // useEffectの依存配列チェックなど
      reactRefresh.configs.vite, // HMR時にコンポーネントの状態を保持するためのルール
    ],
    languageOptions: {
      ecmaVersion: 2020, // ECMAScriptのバージョン設定
      globals: globals.browser, // ブラウザ環境のグローバル変数を許可
    },
  },
])
