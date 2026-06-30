# Change: Guided Demo Safe Camera Viewport

## Why

Guided Demo 和人工点选航班现在会触发聚焦与轨迹绘制，但左右两侧浮层可能遮挡被选中的飞机，使操作者难以确认当前演示主角。需要让一次性聚焦把目标航班放进不被浮层遮挡的安全视区。

## What Changes

- 为手动/Guided Demo 的 `cameraTarget` 增加安全视区偏移能力，使聚焦落点避开左侧 AI Briefing、右侧 Demo Rail 和底部状态栏。
- 保持自动 Cinema 默认不 zoom/pan；安全视区只作用于用户点选或 Guided Demo 选择航班产生的一次性 camera target。
- 保留现有轨迹绘制、红色 spotlight、高频相机 commit 节流、手势取消相机动画和 live flight 刷新不重播聚焦的行为。

## Impact

- Affected specs: `cinema-engine`, `live-dashboard`
- Affected code: `frontend/src/components/cinema/cameraMath.ts`, `frontend/src/components/tower/GlobeMap.tsx`, `frontend/src/routes/TowerShell.tsx`
- Affected tests: `frontend/src/tests/camera-director.test.ts`, `frontend/src/tests/globe-map-camera.test.tsx`, `frontend/src/tests/tower-shell.test.tsx`
