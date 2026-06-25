import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function websocketOriginFor(httpOrigin: string) {
  if (httpOrigin.startsWith("https://")) {
    return `wss://${httpOrigin.slice("https://".length)}`;
  }
  if (httpOrigin.startsWith("http://")) {
    return `ws://${httpOrigin.slice("http://".length)}`;
  }
  return httpOrigin;
}

const backendOrigin = withoutTrailingSlash(
  process.env.VITE_DEV_BACKEND_ORIGIN?.trim() || "http://localhost:8000",
);
const backendWebSocketOrigin = websocketOriginFor(backendOrigin);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendOrigin,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/ws": { target: backendWebSocketOrigin, ws: true },
    },
  },
});
