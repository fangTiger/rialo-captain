## 1. 部署配置

- [x] 1.1 添加 Vercel 配置，包含生产校验、Vite build、`dist` 输出和 SPA fallback。
- [x] 1.2 添加生产环境变量校验脚本，并覆盖成功/失败路径。
- [x] 1.3 更新前端环境变量示例，说明外部后端 API/WS 地址。

## 2. 前端连接

- [x] 2.1 让 API client 支持 `VITE_API_BASE_URL`，未配置时保持 `/api` 代理行为。
- [x] 2.2 让 WebSocket hook 支持 `VITE_WS_BASE_URL`，未配置时保持当前 host `/ws` 行为。
- [x] 2.3 为 API/WS 地址解析补充前端测试。

## 3. 验证与归档

- [x] 3.1 运行 OpenSpec strict 校验。
- [x] 3.2 运行前端测试和生产构建。
- [x] 3.3 完成后归档本变更。
