# Design System

## Foundation

**Component Library**: shadcn/ui (New York style) built on Radix UI primitives
**Styling**: Tailwind CSS with CSS variables for theming
**Utilities**: `cn()` helper (clsx + tailwind-merge), CVA for component variants
**Animations**: `motion` library + `tailwindcss-animate`
**Icons**: `lucide-react` (primary), `react-icons` (supplemental), custom SVGs in `common/icons.tsx`

## Color Palette

### Brand Colors

| Token               | Value                | Usage                                         |
| ------------------- | -------------------- | --------------------------------------------- |
| `highlight`         | `#9bfd9e`            | Primary brand accent (neon green)             |
| `gb-pastel-green-1` | `#b6fadf`            | Light pastel green                            |
| `gb-pastel-green-2` | `#4e8c71`            | Darker green, used for headings/bold in prose |
| `--bg`              | `hsl(202, 61%, 22%)` | Brand background (deep blue-gray)             |
| `--darker-bg`       | `#111827`            | Darker background variant                     |

### Theme Tokens (CSS Variables)

Dark mode is class-based (`.dark` on `<html>`), persisted to `localStorage` key `vite-ui-theme`.

**Light theme:**

- Background: `hsl(194, 52%, 67%)` (light blue-gray)
- Foreground: near black
- Primary: `hsl(220.9, 39.3%, 11%)`

**Dark theme (default):**

- Background: `hsl(202, 61%, 22%)` (deep blue-gray)
- Foreground: `hsl(194, 52%, 67%)` (light blue-gray)
- Primary: `hsl(194, 52%, 67%)`

Standard shadcn semantic tokens are available: `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `card`, `popover`, `border`, `input`, `ring`.

## Typography

**Font**: JetBrains Mono (monospace) — self-hosted WOFF2 files in `/public/fonts/`

| Weight | Variant                 |
| ------ | ----------------------- |
| 400    | Regular (SemiBold file) |
| 600    | Bold                    |
| 900    | Black (ExtraBold file)  |

Italics available for 400 and 900 weights.

### Fluid Scale

Uses a perfect fourth ratio (1.333) with `clamp()` for responsive sizing:

```
--font-size-1 → base
--font-size-2 → base × 1.333
--font-size-3 → base × 1.333²
--font-size-4 → base × 1.333³
--font-size-5 → base × 1.333⁴
```

All heading levels (`h1`–`h6`) use fluid sizing via viewport-based clamping.

## Spacing & Borders

**Border radius**: `0px` base — sharp corners, no rounding. The `--radius` CSS variable controls `lg`, `md`, `sm` variants.

**Subtle scale effects**: Custom Tailwind `scale` values for hover interactions:

- `scale-101` through `scale-104` (1.01–1.04)

## Components (shadcn/ui)

Located in `src/components/ui/`:

| Category     | Components                                                                        |
| ------------ | --------------------------------------------------------------------------------- |
| Form & Input | `button`, `input`, `textarea`, `checkbox`, `select`, `input-otp`, `label`, `form` |
| Navigation   | `breadcrumb`, `tabs`, `command`, `dropdown-menu`, `context-menu`, `sheet`         |
| Feedback     | `toast`, `toaster`, `dialog`, `tooltip`, `skeleton`                               |
| Layout       | `card`, `scroll-area`, `accordion`, `badge`                                       |

## Layout Architecture

**App Shell** (`AppShell`):

- Grid: `sm:grid-cols-[auto_1fr]` (side nav + content)
- Sticky desktop sidebar (`DesktopSideNav`, 14px width) — hidden on mobile
- Floating action button menu on mobile (`FloatingMenu`)
- Fixed compact audio player at bottom (`GlobalCompactPlayer`)
- Fullscreen player overlay option
- Main scroll container identified by `MAIN_SCROLL_CONTAINER_ID`

**Responsive strategy**: Mobile-first with `sm:` breakpoint for desktop layout changes.

**Content padding**: `pb-28 sm:pb-32` to clear the bottom player.

## Custom Utility Classes

Defined in `src/styles/main.css`:

| Class              | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| `.title`           | Large display titles (3xl–7xl responsive)             |
| `.button-glow`     | Glowing button effect                                 |
| `.hover-lift`      | Subtle lift on hover                                  |
| `.hover-glow`      | Glow effect on hover                                  |
| `.button-loading`  | Loading state for buttons                             |
| `.pulse-highlight` | Pulse animation for active states                     |
| `.default-icon`    | Standard icon sizing (`w-6 h-6`) with hover highlight |
| `.curated-posts`   | Grid layout for content cards                         |
| `.shadooo`         | Custom inset shadow effect                            |

## Animations

**Tailwind animations** (`tailwind.config.js`):

- `spin-slow`: 3s continuous rotation
- `accordion-down` / `accordion-up`: 0.2s ease-out expand/collapse
- `overflow-title-marquee`: Text scrolling for overflow titles

**Motion library patterns**:

- `AnimatePresence` for mount/unmount transitions
- Common: fade in/out, slide up/down, rotate

## Interaction Patterns

- All interactive elements have `transition-all duration-200`
- Focus-visible: custom ring + shadow styling
- Keyboard navigation support (Escape key dismisses overlays)
- `sr-only` used for screen reader accessibility

## Prose / Content Styling

Via `@tailwindcss/typography` plugin with overrides:

- Heading color: `var(--pastel-green-2)`
- Bold text: `var(--pastel-green-2)`
- Body text: `var(--default-text)`
- Blockquotes: dark background with `highlight` left border

## File Organization

```txt
src/components/
├── ui/                 # shadcn/ui primitives
├── common/             # shared reusable components (icons, etc.)
├── dashboard/          # dashboard feature components
├── profile/            # profile feature components
├── upload/             # upload feature components
└── [feature]/          # other feature folders
```

Pattern: feature folders with barrel exports (`index.ts`), composition of small components over monolithic ones.
