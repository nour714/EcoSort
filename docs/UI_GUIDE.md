# EcoSort UI Design System & Component Guide

## 1. Overview & Stack

EcoSort is built with **Flask + Vanilla JavaScript + Pure CSS**.
No build steps, no client-side frameworks, and zero external runtime dependencies.
Typography is powered by self-hosted **Cairo** WOFF2 subsets (Arabic and Latin), loaded with `font-display: swap`.

---

## 2. Design Tokens (`static/css/style.css`)

### Semantic Colors
| Token | Light Theme | Dark Theme (`prefers-color-scheme: dark`) | Role |
|---|---|---|---|
| `--color-bg` | `#f8fafc` | `#090e17` | Page viewport background |
| `--color-surface` | `#ffffff` | `#131d2e` | Card & container surface |
| `--color-surface-elevated`| `#ffffff` | `#1e293b` | Elevated modals, dropdowns |
| `--color-text` | `#0f172a` | `#f8fafc` | Primary body and heading text |
| `--color-text-muted` | `#475569` | `#94a3b8` | Secondary labels (passes 4.5:1 WCAG) |
| `--color-text-subtle` | `#64748b` | `#cbd5e1` | Tertiary hints and metadata |
| `--color-primary` | `#059669` | `#10b981` | Brand emerald primary actions |
| `--color-primary-hover` | `#047857` | `#34d399` | Hover/active states |
| `--color-primary-contrast`| `#ffffff` | `#090e17` | Text on primary buttons |
| `--color-success` | `#16a34a` | `#22c55e` | Success states and confident badges |
| `--color-warning` | `#d97706` | `#f59e0b` | Caution, medium confidence alerts |
| `--color-danger` | `#dc2626` | `#ef4444` | Errors, rejected classification |
| `--color-info` | `#0284c7` | `#38bdf8` | Informational callouts and tips |
| `--color-border` | `#e2e8f0` | `#233248` | Container boundaries and dividers |
| `--color-focus` | `#10b981` | `#34d399` | 3px visible focus ring |

### Spacing Scale
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-12`: 48px

### Radius Scale
- `--radius-sm`: 8px (small badges, tags, icons)
- `--radius-md`: 12px (buttons, input fields)
- `--radius-lg`: 16px (standard cards, containers)
- `--radius-full`: 9999px (pills, circular indicators)

### Touch Targets
- Desktop min-target: 44px (`--target-min-size: 44px`)
- Touch / Mobile target: 48px (`--target-touch-size: 48px`)

---

## 3. Core Components

### 3.1 Card (`.card`)
Container surface with standard padding, subtle shadow, and responsive borders.
```html
<article class="card">
    <div class="card-header">
        <h3 class="card-title">Card Heading</h3>
        <p class="card-subtitle">Secondary description</p>
    </div>
    <div class="card-body">
        <!-- Content -->
    </div>
</article>
```

### 3.2 Buttons (`.btn`)
- **Primary**: `.btn.btn-primary` (One per screen, emerald filled)
- **Secondary**: `.btn.btn-outline` (Outlined, neutral border)
- **Icon-only**: `.btn.btn-icon` (Ensures minimum 44x44px target with `aria-label`)
- **Sizes**: `.btn-sm`, `.btn-lg`
```html
<!-- Primary action -->
<button type="button" class="btn btn-primary btn-lg">Primary Action</button>

<!-- Secondary action -->
<button type="button" class="btn btn-outline">Secondary Action</button>

<!-- Icon action -->
<button type="button" class="btn btn-icon" aria-label="Close dialog">
    <svg class="ui-icon" aria-hidden="true"><use href="#icon-x"></use></svg>
</button>
```

### 3.3 Chips (`.chip`, `.category-pill`)
Selectable filters or metadata tags with horizontal scroll snapping.
```html
<div class="chips-row" role="group" aria-label="Faculties">
    <button type="button" class="category-pill active">All (12)</button>
    <button type="button" class="category-pill">Engineering</button>
</div>
```

### 3.4 Banners (`.banner`, `.decision-banner`)
State-driven alert callouts for classification confidence.
- `.decision-banner-confident` (Green surface, verified result)
- `.decision-banner-uncertain` (Amber surface, prompt user confirmation)
- `.decision-banner-rejected` (Red surface, retake guidance)
```html
<div class="decision-banner decision-banner-confident" role="status">
    <svg class="ui-icon text-emerald-600" aria-hidden="true"><use href="#icon-check-circle"></use></svg>
    <div>
        <strong>Confirmed Classification</strong>
        <p>Recognized with 96% confidence.</p>
    </div>
</div>
```

### 3.5 Stepper (`.stepper-nav`)
Numbered progression indicator with accessible ARIA state.
- `.step-indicator.active` (`aria-current="step"`)
- `.step-indicator.completed`
```html
<nav class="stepper-nav" aria-label="Workflow Steps">
    <div class="step-indicator active" aria-current="step">
        <span class="step-num">1</span>
        <span class="step-title">Scan Waste</span>
    </div>
</nav>
```

### 3.6 Bottom Action Bar (`.bottom-action-bar`, `.wizard-bottom-actions`)
Sticky mobile action bar anchored to the bottom of the viewport with iOS safe area padding.
```html
<div class="bottom-action-bar">
    <button type="button" class="btn btn-primary btn-lg w-full">
        Find Nearest Bin
    </button>
</div>
```

### 3.7 Disclosure (`.disclosure-panel`, `<details class="advanced-disclosure">`)
Collapsible panels for secondary technical details (model parameters, Dijkstra vs A* metrics).
```html
<details class="advanced-disclosure">
    <summary class="disclosure-summary">
        <span>Technical Details (Evaluation Committee)</span>
        <svg class="ui-icon" aria-hidden="true"><use href="#icon-chevron-down"></use></svg>
    </summary>
    <div class="disclosure-content">
        <!-- Model latency, top-k probabilities, decision rules -->
    </div>
</details>
```

### 3.8 Skeleton Loading (`.skeleton`)
Shimmering placeholder displayed while `/predict` inference is executing.
```html
<div class="skeleton-card" aria-busy="true" aria-live="polite">
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-badge"></div>
</div>
```

### 3.9 Toast Notifications (`.toast-notification`)
Non-blocking notification banner announced via `role="alert"` and `aria-live="assertive"`.
```html
<div id="eco-toast-notification" class="toast-notification hidden" role="alert" aria-live="assertive">
    <div id="toast-icon" class="toast-icon"></div>
    <div class="toast-body">
        <strong id="toast-title" class="toast-title">Title</strong>
        <p id="toast-message" class="toast-message">Description</p>
    </div>
</div>
```

---

## 4. Accessibility (WCAG 2.1 AA Checklist)

1. **Skip Link**: Top of the DOM (`<a href="#main-content" class="skip-link">`), visible upon keyboard `Tab`.
2. **Focus Management**: Clean `:focus-visible` ring (`3px solid var(--color-focus)` with `2px offset`).
3. **Contrast**: All text/background combinations satisfy minimum 4.5:1 ratio (large text 3:1).
4. **Color Independence**: Color is never the sole carrier of information (icons and text always accompany status).
5. **Reduced Motion**: Respects `prefers-reduced-motion: reduce` by suppressing laser animations and route simulation transitions.
