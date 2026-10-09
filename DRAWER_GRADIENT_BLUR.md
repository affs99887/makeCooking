npm install -g https://gaccode.com/codex/install# 抽屉底部渐变模糊实现说明

这份文档说明一种通用的“底部渐变模糊”做法，适用于抽屉、弹层、卡片等底部操作区。核心是叠加两层：线性渐变遮罩 + 径向发光模糊，再结合可选的 `backdrop-filter`，即可得到柔和的“雾化/毛玻璃”过渡。

## 1. 核心思路

- 线性渐变遮罩：让底部区域从透明过渡到接近实色，遮住内容边界并形成柔和过渡。
- 发光模糊层：在底部上方叠一个径向渐变，并加 `filter: blur(...)`，制造“雾”与“光晕”。
- 可选真实模糊：在底部或抽屉本体上加 `backdrop-filter`，增强玻璃质感（兼容性允许时）。

## 2. 结构层级建议

```html
<div class="drawer">
  <div class="drawer-content">
    <!-- 可滚动内容 -->
    <div class="drawer-spacer"></div>
  </div>
  <div class="drawer-footer">
    <div class="footer-glow"></div>
    <div class="footer-actions">...</div>
  </div>
</div>
```

要点：
- `drawer-footer` 处于最上层，覆盖底部内容。
- `drawer-spacer` 让滚动内容不会被底部区域遮住。

## 3. 通用 CSS 实现

```css
.drawer {
  position: relative;
  height: 100%;
  background: var(--drawer-bg, #faf8f5);
  overflow: hidden;
}

.drawer-content {
  height: 100%;
  overflow-y: auto;
  padding: 0 24px;
  box-sizing: border-box;
}

.drawer-spacer {
  height: var(--footer-height, 120px);
}

.drawer-footer {
  position: sticky;
  bottom: 0;
  padding: 16px 24px calc(16px + env(safe-area-inset-bottom));
  background: linear-gradient(
    180deg,
    var(--fade-0, rgba(250, 248, 245, 0)) 0%,
    var(--fade-1, rgba(250, 248, 245, 0.85)) 35%,
    var(--fade-2, rgba(250, 248, 245, 0.98)) 100%
  );
  z-index: 10;
  box-sizing: border-box;
}

.footer-glow {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 280px;
  height: 90px;
  background: radial-gradient(
    ellipse at center,
    rgba(184, 169, 211, 0.18) 0%,
    transparent 70%
  );
  filter: blur(30px);
  pointer-events: none;
}

.footer-actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
}
```

说明：
- `drawer-footer` 用线性渐变实现“底部雾化”。
- `footer-glow` 用径向渐变 + `filter` 做软光晕。
- `position: sticky` 适合滚动容器内部；若抽屉是 `position: fixed`，可改成 `position: fixed`。

## 4. 可选增强：真实模糊层

当运行环境支持时，可给底部或抽屉容器加 `backdrop-filter`，让背景内容产生真实模糊：

```css
.drawer-footer {
  backdrop-filter: blur(14px) saturate(140%);
}
```

兼容性处理建议：
- 非支持环境仅保留渐变与发光层，视觉仍然成立。
- 可通过 `@supports (backdrop-filter: blur(1px)) { ... }` 做特性检测。

## 5. 变量与参数建议

你可以通过变量快速换肤或调味：

```css
:root {
  --drawer-bg: #faf8f5;
  --fade-0: rgba(250, 248, 245, 0);
  --fade-1: rgba(250, 248, 245, 0.85);
  --fade-2: rgba(250, 248, 245, 0.98);
  --footer-height: 120px;
}
```

调参要点：
- 过渡更柔和：增加 `fade-1` 的透明度、放大 `footer-glow` 的尺寸。
- 更强调内容：降低 `fade-2` 的不透明度，或缩短渐变高度。
- 深色主题：替换为暗色 `fade` 与 `glow` 颜色即可。

## 6. 常见问题与注意事项

- 内容被遮住：确保 `drawer-spacer` 高度 ≥ `drawer-footer` 实际高度。
- 性能：尽量控制 `filter: blur(...)` 的尺寸与数量，避免大面积重绘。
- 点击穿透：给发光层 `pointer-events: none`，避免挡住按钮。

## 7. 小程序 / 跨端换算

如果是小程序 / 跨端环境，将 `px` 换成 `rpx` 即可，结构与逻辑不变。  
你也可以把变量放到容器根节点上，实现不同抽屉的局部主题覆盖。

---

如果你需要，我可以再补一份“深色模式变量配置 + 动态高度计算”的版本，方便直接复制到新项目里。
