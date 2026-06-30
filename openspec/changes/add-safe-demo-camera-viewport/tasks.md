## 1. Spec And Geometry

- [x] 1.1 Add failing camera math coverage for safe-area camera target anchoring.
- [x] 1.2 Extend the camera target viewport conversion to support safe-area insets without changing default centered behavior.

## 2. Tower Integration

- [x] 2.1 Add failing TowerShell coverage proving manual/Guided Demo selected flights receive a safe-area camera target.
- [x] 2.2 Implement one-shot manual/Guided Demo camera targets with safe-area insets while keeping live flight refresh from replaying camera focus.
- [x] 2.3 Preserve existing selected-flight trail TTL and GlobeMap camera commit throttling.

## 3. Verification

- [x] 3.1 Run focused frontend tests for camera math, GlobeMap, TowerShell, and Guided Demo.
- [x] 3.2 Run a browser verification that selected-flight focus lands outside side panels and has no maximum-update-depth warning.
- [x] 3.3 Run `openspec validate add-safe-demo-camera-viewport --strict --no-interactive`.
- [x] 3.4 Rebuild graphify after implementation.
