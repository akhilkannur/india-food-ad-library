# India Food Ad Library design

The public site is a creative research workspace. The ads provide the visual richness.

- Structure: compact page heading, one search/filter/sort toolbar, a short format rail, creative grid, detail inspector.
- Typography: Fraunces for expressive, upright serif headings; Manrope for controls and copy; IBM Plex Mono only for keyboard hints.
- Palette: soft peach and lilac radial gradients fade into a cool off-white base. No dotted texture or animated background. Forest actions, terracotta heading accents and soft apricot/sage format tiles. Use the named tokens in `tokens.css`; avoid independent palettes for dialogs or subpages.
- Controls: consistent 44px minimum touch targets, restrained rounded corners, visible keyboard focus, sorting available on mobile.
- Gallery: a flowing masonry pinboard, not uniform compartments. Images and video posters determine their own height from intrinsic dimensions, with no fixed aspect ratio or crop. Borderless captions sit directly on the paper. Keep DOM ordering and keyboard access intact; resize and late media loads must repack without overlaps. Only unloaded/unavailable previews use a temporary fallback ratio. Missing media must not remove the card or close the inspector.
- Navigation: the library is one destination. Format and brand routes inherit the same page shell and controls.
- Counts: no promotional ad totals or brand totals. Keep internal pagination totals separate from presentation.
- Motion: no decorative animation. Use immediate state changes and respect reduced-motion preferences.

`src/app/base.css` owns the reset and font/token imports. `src/app/product.css` owns public component styling. The historical global/workbench styles load only within admin routes. Public changes must be made in the owning rules rather than adding another redesign stylesheet.
