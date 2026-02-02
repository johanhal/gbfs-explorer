export enum Mode {
  DEV = "development",
  PROD = "production",
}

interface WithEnvMode {
  readonly env: {
    readonly MODE: Mode;
  };
}

export const mode = (import.meta as unknown as WithEnvMode).env.MODE;

// App base path for routing (e.g., "/tools/gbfs-explorer/" in production)
declare const __APP_BASE_PATH__: string;
export const APP_BASE_PATH = __APP_BASE_PATH__;

// API URL is relative - same origin
export const API_URL = "";

// Legacy exports for compatibility
export const APP_ID = "gbfs-explorer";
export const API_PATH = "/api";
export const API_HOST = "";
export const API_PREFIX_PATH = "";
export const WS_API_URL = "";
export const APP_TITLE = "GBFS Explorer";
export const APP_FAVICON_LIGHT = "/favicon-light.svg";
export const APP_FAVICON_DARK = "/favicon-dark.svg";
export const APP_DEPLOY_USERNAME = "";
export const APP_DEPLOY_APPNAME = "";
export const APP_DEPLOY_CUSTOM_DOMAIN = "";
