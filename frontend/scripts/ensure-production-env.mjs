import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const invalidValues = new Set([
  "placeholder",
  "change-me",
  "your-google-client-id.apps.googleusercontent.com",
  "pk.your-mapbox-public-token",
]);

function readDeployConfig() {
  const configPath =
    process.env.RIALO_DEPLOY_CONFIG_PATH?.trim() ||
    resolve(process.cwd(), "deploy.config.json");
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error("生产环境变量校验失败：");
    console.error(
      `- 无法读取 deploy.config.json: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

function readStringConfig(config, key) {
  return typeof config[key] === "string" ? config[key].trim() : "";
}

function readBooleanConfig(config, key) {
  return typeof config[key] === "boolean" ? config[key] : null;
}

function readResolvedString(config, envName, key) {
  return readEnv(envName) || readStringConfig(config, key);
}

function readResolvedBoolean(config, envName, key) {
  const envValue = readEnv(envName);
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return readBooleanConfig(config, key);
}

function isPlaceholder(value) {
  return !value || invalidValues.has(value) || value.startsWith("your-");
}

function isValidUrl(value, protocols) {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol);
  } catch {
    return false;
  }
}

const deployConfig = readDeployConfig();
const googleClientId = readResolvedString(
  deployConfig,
  "VITE_GOOGLE_CLIENT_ID",
  "googleClientId",
);
const mapboxToken = readResolvedString(
  deployConfig,
  "VITE_MAPBOX_TOKEN",
  "mapboxToken",
);
const apiBaseUrl = readResolvedString(
  deployConfig,
  "VITE_API_BASE_URL",
  "apiBaseUrl",
);
const wsBaseUrl = readResolvedString(deployConfig, "VITE_WS_BASE_URL", "wsBaseUrl");
const devLoginEnabled = readResolvedBoolean(
  deployConfig,
  "VITE_DEV_LOGIN_ENABLED",
  "devLoginEnabled",
);
const errors = [];

if (devLoginEnabled !== true) {
  if (isPlaceholder(googleClientId)) {
    errors.push("googleClientId 缺失或仍为占位值，生产部署前必须填入 Google OAuth Client ID。");
  } else if (!googleClientId.endsWith(".apps.googleusercontent.com")) {
    errors.push("googleClientId 格式异常，必须使用 Google OAuth Web Client ID。");
  }
}

if (isPlaceholder(mapboxToken)) {
  errors.push("mapboxToken 缺失或仍为占位值，生产部署前必须填入 Mapbox public token。");
} else if (!mapboxToken.startsWith("pk.")) {
  errors.push("mapboxToken 格式异常，Mapbox 前端 public token 必须以 pk. 开头。");
}

if (!apiBaseUrl && devLoginEnabled !== true) {
  errors.push("apiBaseUrl 缺失，生产部署前必须填入外部 FastAPI 后端 HTTP(S) 地址。");
} else if (apiBaseUrl && !isValidUrl(apiBaseUrl, ["http:", "https:"])) {
  errors.push(`apiBaseUrl 的值 "${apiBaseUrl}" 非法，必须是 http:// 或 https:// 开头的有效 URL。`);
}

if (!wsBaseUrl && devLoginEnabled !== true) {
  errors.push("wsBaseUrl 缺失，生产部署前必须填入外部 FastAPI 后端 WebSocket 地址。");
} else if (wsBaseUrl && !isValidUrl(wsBaseUrl, ["ws:", "wss:", "http:", "https:"])) {
  errors.push(`wsBaseUrl 的值 "${wsBaseUrl}" 非法，必须是 ws://、wss://、http:// 或 https:// 开头的有效 URL。`);
}

if (devLoginEnabled !== true && devLoginEnabled !== false) {
  errors.push("devLoginEnabled 必须明确设置为 true 或 false。");
}

if (errors.length > 0) {
  console.error("生产环境变量校验失败：");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("生产环境变量校验通过");
