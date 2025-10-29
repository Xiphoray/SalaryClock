# SalaryClock

A minimal, elegant, and configurable “real-time earnings” web app. It displays how much you have earned so far today, with rolling odometer-style digits, day/night themes, and a simple settings modal. Supports cookie/localStorage persistence and a single-file offline build.

[English](#english) | [中文](#中文)

<p>
  <a href="https://img.shields.io/badge/license-MIT-green.svg"><img alt="License" src="https://img.shields.io/badge/license-MIT-green.svg"></a>
  <a href="https://img.shields.io/badge/bootstrap-3.3.2-7952B3"><img alt="Bootstrap" src="https://img.shields.io/badge/bootstrap-3.3.2-7952B3"></a>
  <a href="https://img.shields.io/badge/jquery-2.1.3-0769AD"><img alt="jQuery" src="https://img.shields.io/badge/jquery-2.1.3-0769AD"></a>
</p>

---

## 中文

### 功能亮点
- 实时工资滚动显示（两位小数），精确到毫秒，滚轮仅“向前”滚动，支持跨位进位联动。
- 右上角齿轮打开“设置”：月薪、上班天数、上班/午休时间、是否包含午休、刷新间隔等；即时校验时间是否合法（超范围即提示）。
- 首次访问自动写入默认配置，后续从 Cookie（或 localStorage 回退）读取；设置后立即持久化并生效。
- 自动适配日/夜间模式（`prefers-color-scheme`）；时间选择器图标跟随主题变色。
- 提供单文件版本 `moneyclock.html`，可离线使用。

### 目录结构
```text path=null start=null
G:/t/code/2025/moneyclock
├─ index.html                 # CDN 在线版（外链 CSS/JS）
├─ moneyclock.html            # 单文件离线版（已内联 CSS/JS）
├─ assets/
│  ├─ styles.css             # 样式（含日/夜主题、设置框样式、滚轮动画等）
│  └─ app.js                 # 逻辑（计算、动画、设置、校验、持久化）
├─ scripts/
│  └─ build-standalone.mjs   # 生成单文件的构建脚本（Node.js ≥ 18）
└─ package.json              # 构建脚本声明
```

### 快速开始
- 预览（需联网）：直接双击 `index.html`。
- 离线使用：直接打开 `moneyclock.html`。
- 生成单文件（可选）：
  1) 安装 Node.js ≥ 18
  2) 项目根目录执行：
     ```bash path=null start=null
     npm run build:standalone
     ```
     生成 `dist/standalone.html`（功能等同于 `moneyclock.html`）。

### 设置项（默认值）
- 月薪（元）：`7000`
- 每月上班天数：`21.75`
- 上班时间：`08:00 - 17:30`
- 午休时间：`11:30 - 12:00`
- 上班时间包含午休：`是`
- 刷新时间（秒）：`1`

输入校验：
- 上班结束时间必须晚于开始时间
- 午休结束时间必须晚于开始时间
- 午休时间必须完全落在上班时间范围内（越界即提示并标红）

### 计算规则（今日已获得工资）
- 日薪 = 月薪 / 每月上班天数
- 实际工作时长 = 上班时段内累计秒数（必要时扣除与午休重叠部分）
- 今日进度 = 实际工作时长 / 当日总工作时长
- 今日已得 = 日薪 × 今日进度（保留两位小数，限制在 `[0, 日薪]`）

### 可访问性与兼容
- 数字容器 `aria-live="polite"`，滚动动画尽量平滑。
- 使用原生 `<input type="time">`；图标日夜样式自动适配（WebKit 前缀方案）。
- 依赖：Bootstrap 3.3.2、jQuery 2.1.3。

### 开发者须知
- 主要 DOM 标识统一加前缀 `moneyclock-`（示例：`#moneyclock-wage`、`#moneyclock-settings-modal`）。
- 滚轮动画基于重复数字带与中位归一，保证 9→0 前进且无回滚错觉。
- 如需扩展字段或动画，请在 `assets/app.js` 与 `assets/styles.css` 同步修改。

### 许可证
- 本项目使用 MIT 许可证。

---

## English

### Features
- Real-time rolling digits (2 decimals) with forward-only carry animation across places.
- Settings modal (gear on top-right): monthly salary, workdays per month, work time, lunch time, include-lunch toggle, refresh interval; immediate time validation on change.
- First visit writes defaults; subsequent visits load from Cookie (fallback to localStorage). Changes persist instantly.
- Auto day/night theme (`prefers-color-scheme`); native time-picker icon adapts to theme.
- Single-file build `moneyclock.html` for offline use.

### Project Structure
```text path=null start=null
G:/t/code/2025/moneyclock
├─ index.html                 # CDN online version (external CSS/JS)
├─ moneyclock.html            # Single-file offline version (inlined CSS/JS)
├─ assets/
│  ├─ styles.css             # Styles (themes, modal, wheel/odometer effects)
│  └─ app.js                 # Logic (calc, animation, settings, validation, persistence)
├─ scripts/
│  └─ build-standalone.mjs   # Build script to produce standalone HTML (Node.js ≥ 18)
└─ package.json              # Scripts
```

### Quick Start
- Preview (online): open `index.html` directly (loads CDN).
- Offline: open `moneyclock.html`.
- Build standalone (optional):
  ```bash path=null start=null
  npm run build:standalone
  ```
  Outputs `dist/standalone.html`.

### Settings (defaults)
- Monthly salary: `7000`
- Workdays per month: `21.75`
- Work time: `08:00 - 17:30`
- Lunch time: `11:30 - 12:00`
- Include lunch: `true`
- Refresh interval (sec): `1`

Validation:
- Work end must be later than work start.
- Lunch end must be later than lunch start.
- Lunch must be within the work period (otherwise alert + visual highlight).

### Calculation
- Day salary = monthly_salary / workdays_per_month
- Worked seconds = time within work window (minus overlap with lunch if excluded)
- Progress = worked_seconds / total_work_seconds
- Earned today = day_salary × progress (2 decimals, clamped `[0, day_salary]`)

### Accessibility & Compatibility
- `aria-live="polite"` on the wage container for assistive tech.
- Native `<input type="time">`; theme-aware icon via `::-webkit-calendar-picker-indicator`.
- Dependencies: Bootstrap 3.3.2, jQuery 2.1.3.

### Development Notes
- IDs/classes are prefixed with `moneyclock-` (e.g., `#moneyclock-wage`, `#moneyclock-settings-modal`).
- Odometer effect uses repeated digit wheels and center normalization to ensure forward-only rolls.
- Extend behavior/styles in `assets/app.js` and `assets/styles.css` as needed.

### License
- MIT.

