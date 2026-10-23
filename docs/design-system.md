# Design System

GBFM is a compact, music-first archive and studio tool, not a generic SaaS kit. Keep the interface restrained so square cover art, titles, and music metadata carry the visual richness.

## Ownership

- `packages/theme/src/tokens/brand.ts` owns the brand palette; `packages/theme/styles/theme.css` supplies shared semantic CSS variables through `@gbfm/theme/styles.css`.
- `apps/www/src/styles/main.css` maps those variables into Tailwind CSS v4 and owns web utilities, typography, and motion styles.
- `apps/www/src/view/` owns shared Foldkit presentation, including artwork, icons, links, navigation, and rich content.
- `@foldkit/ui` supplies accessible dialog and popover primitives. State, messages, commands, and workflow behavior belong to the feature or page submodel, not a shared UI package.
- React is still used by Expo mobile, React Email templates, and social-image rendering. It is not the WWW view layer.

See [FOLDKIT.md](../FOLDKIT.md) for runtime, navigation, and folder conventions.

## Visual language

- Prefer rectangular surfaces, sharp corners, and visible borders. The base radius is `0px`.
- Use high-contrast dark surfaces with cyan/green accents from the shared theme. Do not copy old palette values into components or introduce new theme selectors without a product requirement.
- Prefer semantic classes such as `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-highlight`, and `ring-ring`. Existing `gb-*` classes map to the same shared brand variables in WWW.
- Keep secondary metadata readable. Use muted text, not near-invisible contrast.
- Use square, cover-art-led imagery and the shared artwork view for responsive delivery and fallbacks.
- Keep layouts dense where users work with metadata. Use whitespace to separate functional groups rather than adding decorative space.

## Typography and layout

- WWW uses self-hosted JetBrains Mono through `apps/www/src/styles/fonts.css`.
- Headings use direct weight and size. Eyebrows may use uppercase text and wide tracking.
- Metadata and help text use compact sizes; long media titles should truncate or scroll where space is constrained.
- Use responsive grids for artwork, compact label/control groups, and wrapping inline actions.
- Preserve bottom content clearance for the fixed player and mobile-first navigation.
- Keep prose headings, bold text, links, and blockquotes readable against their surface.

## Interaction and states

- Motion confirms interactivity: small lifts, border emphasis, subtle image scaling, and short transitions. Respect reduced motion.
- Keep keyboard focus visible. Label controls, name icon-only actions, preserve native input types, and make disabled/loading states clear.
- Prefer native selects, sliders, and disclosures when they already meet the need. Use the Foldkit primitives for modal focus, dismissal, and scroll locking.
- Show loading progress or skeletons, useful empty-state instructions, and visible errors. Use badges and metadata for draft/published/review status rather than oversized alerts.
- Compose existing views before adding new styling patterns. Keep data fetching, persistence, playback, and route behavior in their owning submodels.
- Verify realistic music content, long titles, empty/loading/error states, keyboard interaction, and constrained widths through the running app and existing browser tests. There is no separate story gallery.
