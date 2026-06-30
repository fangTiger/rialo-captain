## MODIFIED Requirements

### Requirement: CameraDirector 与 GlobeMap viewport 整合
系统 SHALL 保留 `CameraDirector` 与 `GlobeMap.cameraTarget` 的兼容接口，但默认 cinema 自动播放 SHALL 使用 spotlight 高亮目标而不是 viewport zoom/pan；不得破坏当前 hover、点击导航、滚轮缩放和拖拽行为。手动点选或 Guided Demo 选择航班产生的一次性 `cameraTarget` MAY 包含安全视区约束，使目标航班聚焦后避开浮层遮挡。

#### Scenario: protagonistHighlight 驱动主角视觉标识
- **GIVEN** Cinema state 有当前 protagonist 且 phase 到达 spotlight 展示窗口
- **WHEN** `TowerShell` 渲染 `GlobeMap`
- **THEN** `GlobeMap` SHALL 接收当前 protagonist highlight 信息
- **AND** 与 protagonist 匹配的飞机点 SHALL 带有 `data-protagonist="true"` 或等价可测标识
- **AND** 高亮 SHALL 使用现有地图投影和当前 viewport 位置

#### Scenario: CameraDirector 默认不驱动 viewport
- **GIVEN** Cinema 自动播放进入 `zoom-in`、`story` 或 `zoom-out`
- **WHEN** `CameraDirector` 渲染 children
- **THEN** `CameraDirector` SHALL 默认输出 `cameraTarget = null`
- **AND** `GlobeMap` SHALL NOT 自动插值到 `scale(5)` 或任何主角 zoom viewport
- **AND** `cameraTarget` prop SHALL 保留以兼容未来恢复 zoom 的实现

#### Scenario: 用户手势取消高亮过渡并进入 manual
- **GIVEN** 系统处于 cinema 模式且主角高亮 enter/exit 过渡正在播放
- **WHEN** 用户 wheel、drag、keydown 或 click 任意飞机
- **THEN** `CinemaController` SHALL 进入 interactive 模式
- **AND** `GlobeMap` SHALL 保持用户当前 viewport
- **AND** 自动 spotlight 过渡 SHALL 不再强制覆盖用户操作

#### Scenario: 手动 camera target 可使用安全视区
- **GIVEN** 用户手动点选或 Guided Demo 选择了一个可投影航班
- **AND** 该选择创建了一次性 `cameraTarget`
- **WHEN** `GlobeMap` 将该 target 转换成 viewport
- **THEN** 目标航班 SHALL 落在 `cameraTarget` 定义的安全视区内
- **AND** 默认未提供安全视区的 legacy target SHALL 继续落在 viewport 中心
- **AND** 用户 wheel、drag 或 click 手势 SHALL 继续取消进行中的 camera animation
