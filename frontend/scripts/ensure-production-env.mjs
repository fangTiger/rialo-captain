const invalidValues = new Set([
  "placeholder",
  "change-me",
  "your-google-client-id.apps.googleusercontent.com",
  "pk.your-mapbox-public-token",
]);

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
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

const googleClientId = readEnv("VITE_GOOGLE_CLIENT_ID");
const mapboxToken = readEnv("VITE_MAPBOX_TOKEN");
const apiBaseUrl = readEnv("VITE_API_BASE_URL");
const wsBaseUrl = readEnv("VITE_WS_BASE_URL");
const devLoginEnabled = readEnv("VITE_DEV_LOGIN_ENABLED");
const errors = [];

if (isPlaceholder(googleClientId)) {
  errors.push("VITE_GOOGLE_CLIENT_ID 缺失或仍为占位值，生产部署前必须填入 Google OAuth Client ID。");
} else if (!googleClientId.endsWith(".apps.googleusercontent.com")) {
  errors.push("VITE_GOOGLE_CLIENT_ID 格式异常，必须使用 Google OAuth Web Client ID。");
}

if (isPlaceholder(mapboxToken)) {
  errors.push("VITE_MAPBOX_TOKEN 缺失或仍为占位值，生产部署前必须填入 Mapbox public token。");
} else if (!mapboxToken.startsWith("pk.")) {
  errors.push("VITE_MAPBOX_TOKEN 格式异常，Mapbox 前端 public token 必须以 pk. 开头。");
}

if (!apiBaseUrl) {
  errors.push("VITE_API_BASE_URL 缺失，生产部署前必须填入外部 FastAPI 后端 HTTP(S) 地址。");
} else if (!isValidUrl(apiBaseUrl, ["http:", "https:"])) {
  errors.push(`VITE_API_BASE_URL 的值 "${apiBaseUrl}" 非法，必须是 http:// 或 https:// 开头的有效 URL。`);
}

if (!wsBaseUrl) {
  errors.push("VITE_WS_BASE_URL 缺失，生产部署前必须填入外部 FastAPI 后端 WebSocket 地址。");
} else if (!isValidUrl(wsBaseUrl, ["ws:", "wss:", "http:", "https:"])) {
  errors.push(`VITE_WS_BASE_URL 的值 "${wsBaseUrl}" 非法，必须是 ws://、wss://、http:// 或 https:// 开头的有效 URL。`);
}

if (devLoginEnabled !== "false") {
  errors.push("生产环境必须关闭 VITE_DEV_LOGIN_ENABLED，并将其设置为 false。");
}

if (errors.length > 0) {
  console.error("生产环境变量校验失败：");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("生产环境变量校验通过");
