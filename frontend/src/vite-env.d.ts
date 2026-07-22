/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for production builds, e.g. https://api.amsterdammetro.nl */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
