# India Food Ad Library design

The public site is a creative research workspace. The ads provide the visual richness.

- Structure: compact page heading, one search/filter/sort toolbar, a short format rail, creative grid, detail inspector.
- Typography: Space Grotesk for headings; Manrope for controls and copy; IBM Plex Mono only for keyboard hints. All headings are upright.
- Palette: warm neutral paper and cards, forest for primary actions and selected navigation. Use the named tokens in `tokens.css`; avoid independent palettes for dialogs or subpages.
- Controls: consistent 44px minimum touch targets, restrained rounded corners, visible keyboard focus, sorting available on mobile.
- Cards: uncropped media, readable captions, format and media type, obvious detail access. Missing media must have an explanatory fallback and must not remove the card or close the inspector.
- Navigation: the library is one destination. Format and brand routes inherit the same page shell and controls.
- Counts: no promotional ad totals or brand totals. Keep internal pagination totals separate from presentation.
- Motion: no decorative animation. Use immediate state changes and respect reduced-motion preferences.

`src/app/base.css` owns the reset and font/token imports. `src/app/product.css` owns public component styling. The historical global/workbench styles load only within admin routes. Public changes must be made in the owning rules rather than adding another redesign stylesheet.
