## Why

用户实际体验反馈指出当前 Cinema 大屏的镜头推近和预置 DEMO 故事会干扰观看重点。原话：

1. “默认场景动画不用放大，直接在原图展示即可”
2. “如果用户主动下单了一个，那就根据下单的这个点进行场景动画展示，不用展示我们预置的了”

因此需要在已归档 C1/C2/C3 能力之上调整 Cinema 体验：默认保持全球视图，用主角高亮替代 zoom；真实下单事件到达时立即抢占当前故事，并清理旧关键时刻动效。

## What Changes

- CameraDirector / cinema state 不再驱动 `GlobeMap` viewport zoom/pan；`cameraTarget` 兼容 prop 保留，但 cinema 自动播放默认输出 `null`，地图保持全球视图。
- phase 时间线保留 `establish` / `zoom-in` / `story` / `zoom-out` / `rest` 五段，`zoom-in` / `zoom-out` 从镜头过渡改为主角视觉高亮 enter/exit 过渡。
- `GlobeMap` 增加主角高亮目标支持，在当前全球视图中为主角飞机点添加可测的 `data-protagonist="true"`、ring/pulse 或等价 SVG 高亮，不破坏点击导航、hover、wheel、drag。
- REAL `policy.created` 在任意 phase 到达时立即清场抢占：清空 C2/C3 transient moment queue，重置 cycle，phase 回到 `establish`，protagonist 切为 REAL，badge 显示 `REAL · LIVE`。
- REAL burst 保留队列：1 秒内连续多个 REAL 事件只切第一个，其余按 FIFO 入队，继续沿用队列上限 3 和 `+N more` 提示。
- 更新 e2e smoke 断言：不再断言 `scale(5)`，改为断言主角高亮存在。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `cinema-engine`: 默认自动播放、CameraDirector/GlobeMap viewport 语义、真实事件抢占规则、moment queue 清场协同和 e2e 行为断言需要修改。

## Impact

- Affected specs: `cinema-engine`
- Affected frontend code:
  - `frontend/src/components/cinema/cinemaMachine.ts`
  - `frontend/src/components/cinema/CameraDirector.tsx`
  - `frontend/src/components/cinema/CinemaContext.tsx`
  - `frontend/src/components/cinema/EventChoreographer.tsx`
  - `frontend/src/components/cinema/useKeyMomentQueue.ts`
  - `frontend/src/components/tower/GlobeMap.tsx`
  - `frontend/src/routes/TowerShell.tsx`
  - `frontend/e2e/dashboard.spec.ts`
- Affected tests:
  - `frontend/src/tests/cinema-controller.test.tsx`
  - `frontend/src/tests/camera-director.test.ts`
  - `frontend/src/tests/globe-map-camera.test.tsx`
  - `frontend/src/tests/protagonist-queue.test.ts`
  - `frontend/src/tests/cinema-key-moments-integration.test.tsx`
  - `frontend/src/tests/cinema-ambient-integration.test.tsx`
  - `frontend/src/tests/tower-shell.test.tsx`
- Backend impact: none expected. Existing `policy.created` payload is reused.
- Dependencies: no new runtime or animation dependencies.
