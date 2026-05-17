# GBFM UI Design System

This package is the shared React UI layer for GBFM. It contains low-level primitives, GBFM-specific composites, and Ladle stories for visual review.

The current direction is a music-first interface with sharp edges, high-contrast dark surfaces, soft cyan/green foregrounds, and small kinetic interactions. It should feel closer to an underground radio archive, label dashboard, or studio tool than a generic SaaS kit.

## Foundations

The library is built on Tailwind CSS v4, Radix UI primitives, `class-variance-authority`, `lucide-react`, and React 19.

Core exports live in `src/index.ts`. Global CSS is exported as `@gbfm/ui/styles.css` and must be imported by consumers that want the package theme tokens.

Stories live beside components as `*.stories.tsx` and are rendered through Ladle. The kitchen sink story is the main regression surface for checking theme drift across primitives and composites.

## Visual Language

GBFM uses a deliberately rectangular system:

- Corners are almost always `rounded-sm`; the default theme radius is `0px`.
- Borders are visible and often define the component more than background contrast does.
- Cards and buttons can lift on hover, usually with `-translate-y-*`, stronger borders, and larger shadows.
- Highlights are green/cyan, used for primary actions, links, hover states, active icons, and important metadata.
- Secondary text is muted rather than greyed into invisibility; music metadata should remain readable.
- Imagery is square, cover-art-led, and allowed to carry visual richness while the UI stays restrained.

Avoid generic rounded, airy, neutral SaaS patterns. The system should keep a compact, archival, music-community character.

## Theme Tokens

`src/styles.css` defines semantic Tailwind tokens through CSS variables:

- `background`, `foreground`
- `card`, `card-foreground`
- `popover`, `popover-foreground`
- `primary`, `primary-foreground`
- `secondary`, `secondary-foreground`
- `muted`, `muted-foreground`
- `accent`, `accent-foreground`
- `destructive`, `destructive-foreground`
- `border`, `input`, `ring`
- `highlight`, `highlight-foreground`

It currently supports these theme selectors:

- `:root` and `[data-theme="dark"]`: default dark GBFM palette.
- `[data-theme="light"]`: light variant.
- `[data-theme="studio"]`: warmer studio/editorial variant.

Prefer semantic tokens for new package code: `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-highlight`, `ring-ring`.

Some older GBFM-specific classes still appear in composites and app code, including `bg-gb-darker-bg`, `text-gb-pastel-green-1`, `text-gb-highlight`, `border-gb-pastel-green-2`, and `text-gb-default-text`. These come from the app theme layer, not from `packages/ui/src/styles.css`. New shared components should move toward semantic package tokens unless they are intentionally app-bound.

## Typography

Typography is functional and compact:

- Page and section headings use direct weight and size rather than decorative framing.
- Eyebrows use uppercase text with wide tracking, typically `tracking-[0.2em]`.
- Metadata and help text use `text-sm` or `text-xs` with `text-muted-foreground`.
- Monospace is available as `font-jetbrains` and is appropriate for slugs, timestamps, IDs, and technical metadata.
- Long media titles should truncate or use `OverflowTitle` where space is constrained.

Use underlines intentionally for page titles, links, and readable text affordances. Avoid adding a second display type style unless the product direction changes.

## Motion And Interaction

Motion is small and tactile:

- Primary buttons lift on hover and compress on active press.
- Media cards lift and emphasize the highlight border on hover.
- Images can scale subtly within clipped containers.
- Form controls should use visible focus rings and keep keyboard navigation obvious.

Motion should confirm interactivity, not become decoration. Keep transitions short, usually `duration-200` or `duration-300`.

## Component Layers

The package has three practical layers.

Primitives:

- `Button`, `Badge`, `Card`, `Input`, `Textarea`, `Label`, `Checkbox`, `Select`, `Tabs`, `Dialog`, `DropdownMenu`, `ContextMenu`, `Tooltip`, `Accordion`, `ScrollArea`, `Skeleton`, `Toast`, `Form`.
- Most are Radix/shadcn-style wrappers with GBFM theme classes.
- They should stay composable, unopinionated about product data, and export stable props.

Reusable content components:

- `MediaCard`, `PageTitle`, `Section`, `Breadcrumb`, `ProfilePreviewCard`, `IconGrid`, `HorizontalScrollCards`, `OverflowTitle`, `ReadMoreModal`, `LilDate`, `PasswordChecklist`, `TagsInput`, `YoutubeEmbed`.
- These encode GBFM presentation patterns but should remain broadly usable across the app.

Workflow components:

- `AudioUploader`, `AudioFileCard`, `ArtworkUploader`, `AudioDropZone`, `UploadProgress`, `MixUploadProgress`, `TracklistEditor`, music entity detail/forms/panels.
- These can know about GBFM workflows such as uploads, tracklists, publishing states, music metadata, links, artists, and audit details.

## Component Rules

Use primitives first. Build new workflow components by composing existing primitives before adding new styling patterns.

Prefer semantic theme classes in package code. Reach for `gb-*` app tokens only when the component is intentionally coupled to the app theme or is being kept compatible with an existing route.

Keep `className` pass-throughs on reusable components when layout customization is expected. Avoid exposing class overrides for every internal slot unless there is a concrete need.

Use `cva` when a component has meaningful variants or sizes, as with `Button` and `Badge`. Do not introduce `cva` for one-off styling.

Keep forms boring and accessible: label every control, preserve native input types, use `aria-label` for icon-only actions, and keep disabled/loading states visible.

Prefer slot props for workflow surfaces when app code owns the action or data behavior, as seen in `MusicEntityDetail` with metadata, links, relationships, and actions slots.

## Layout Patterns

Common spacing patterns:

- Page-level story/demo containers: `mx-auto w-full max-w-6xl space-y-6`.
- Card content: `p-6` for normal cards, `p-4` for denser media cards.
- Form stacks: `grid gap-1.5` for label/control groups and `space-y-4` for sections.
- Inline actions: `flex flex-wrap items-center gap-2`.
- Media grids: responsive grids with `gap-5` and square images.

Prefer tighter layouts for tooling and metadata screens. Use whitespace to separate functional groups, not to create generic landing-page polish.

## States

Every reusable component should account for the states it naturally owns:

- Loading: use `Skeleton`, progress components, or disabled submit buttons with spinners.
- Empty: use short instructional copy that tells the user what to do next.
- Hover: expose interactivity through border, highlight, translate, or underline.
- Focus: keep visible rings on keyboard-interactive elements.
- Error/destructive: use `destructive` variants or red utility colors where primitives do not yet cover the case.
- Draft/published/review states: use badges and metadata, not large alert blocks by default.

## Stories

Every exported component should have a story unless it is only a helper used by another component.

Stories should show realistic GBFM content: mixes, artists, tracklists, uploads, publishing metadata, links, and archive/editorial copy. Avoid lorem ipsum when a concrete music example would reveal layout problems.

Use `KitchenSink` to catch broad visual regressions. Add focused stories for edge states such as long titles, empty uploaders, loading states, and constrained widths.

## Current Tensions

These are visible in the package today and should guide cleanup work:

- Token split: primitives mostly use semantic tokens, while some workflow components still use app-level `gb-*` classes.
- Radius drift: most components use sharp `rounded-sm`, but a few image placeholders use `rounded-md`.
- Type safety drift: some existing generic form code relies on type assertions. Avoid copying that pattern into new code.
- Component scope: workflow components are useful but can become app-specific quickly. Keep app data fetching and route behavior out of this package.
- Package self-containment: components using `gb-*` classes depend on consuming apps defining those Tailwind tokens.

## Near-Term Direction

The safest next steps are incremental:

- Move shared components toward semantic package tokens so `@gbfm/ui` is more self-contained.
- Keep the dark GBFM palette as the default personality.
- Use `studio` as an intentional alternate mood for editorial/admin contexts if it proves useful.
- Add stories before expanding component APIs.
- Consolidate repeated upload card styling into primitives or small reusable pieces only when duplication becomes painful.
- Keep the library small and product-shaped; do not turn it into a generic component marketplace.

## Questions To Resolve

- Should `gb-*` tokens be formally added to `packages/ui/src/styles.css`, or should package components migrate fully to semantic tokens?
- Is `studio` intended for production surfaces, admin/editorial tools, or only exploration?
- Should the default public-facing GBFM experience be dark-only, or should light theme remain a supported target?
- Do upload workflow components belong permanently in `@gbfm/ui`, or should they move closer to the app once the shared primitives stabilize?
