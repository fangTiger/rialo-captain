import checkedInConfig from "../../deploy.config.json";

export interface PublicDeployConfig {
  googleClientId: string;
  mapboxToken: string;
  apiBaseUrl: string;
  wsBaseUrl: string;
  devLoginEnabled: boolean;
}

interface ResolveOptions {
  production?: boolean;
}

const invalidValues = new Set([
  "",
  "placeholder",
  "change-me",
  "your-google-client-id.apps.googleusercontent.com",
  "pk.your-mapbox-public-token",
]);

function readViteEnv(name: string): string {
  return ((import.meta.env as Record<string, string | undefined>)[name] ?? "").trim();
}

function usable(value: string): string {
  const trimmed = value.trim();
  if (invalidValues.has(trimmed) || trimmed.startsWith("your-")) return "";
  return trimmed;
}

function readBooleanOverride(name: string): boolean | null {
  const value = readViteEnv(name);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function resolvePublicDeployConfig(
  options: ResolveOptions = {},
): PublicDeployConfig {
  const production = options.production ?? import.meta.env.PROD;
  const useCheckedInRuntimeDefaults = production;

  return {
    googleClientId:
      usable(readViteEnv("VITE_GOOGLE_CLIENT_ID")) ||
      (useCheckedInRuntimeDefaults ? checkedInConfig.googleClientId : ""),
    mapboxToken:
      usable(readViteEnv("VITE_MAPBOX_TOKEN")) ||
      (useCheckedInRuntimeDefaults ? checkedInConfig.mapboxToken : ""),
    apiBaseUrl:
      usable(readViteEnv("VITE_API_BASE_URL")) ||
      (useCheckedInRuntimeDefaults ? checkedInConfig.apiBaseUrl : ""),
    wsBaseUrl:
      usable(readViteEnv("VITE_WS_BASE_URL")) ||
      (useCheckedInRuntimeDefaults ? checkedInConfig.wsBaseUrl : ""),
    devLoginEnabled: useCheckedInRuntimeDefaults
      ? checkedInConfig.devLoginEnabled
      : (readBooleanOverride("VITE_DEV_LOGIN_ENABLED") ?? false),
  };
}

export const publicDeployConfig = resolvePublicDeployConfig();
