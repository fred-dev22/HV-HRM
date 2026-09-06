/// <reference types="vite/client" />

declare module 'vue3-org-chart'

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
