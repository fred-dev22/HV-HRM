import type { BrandConfig } from './config/appConfig'

// Proprietes globales disponibles dans tous les templates (voir main.ts).
declare module 'vue' {
  interface ComponentCustomProperties {
    $brand: BrandConfig
    $brandLogo: string
  }
}

export {}
