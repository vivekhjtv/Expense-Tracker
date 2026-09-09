/**
 * Chart palette.
 *
 * These are CSS variable references, not hexes, and that is deliberate: a
 * chart has to repaint when the theme changes, and a hex baked into an SVG
 * attribute cannot. The actual values live in styles.css beside every other
 * token — see `--color-chart-*` there.
 *
 * Both sets were run through the colour-vision validator rather than picked
 * by eye. Against their own surface, on the adjacent pairlist:
 *
 *   light (#ffffff)  #2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300
 *     lightness band PASS · chroma floor PASS
 *     CVD separation PASS (worst #eda100↔#1baf7a ΔE 9.1 protan)
 *     normal vision  PASS (worst ΔE 19.6)
 *     contrast       RELIEF REQUIRED — three slots sit under 3:1 on white
 *
 *   dark  (#141a26)  #4693f3 #e76530 #14ac77 #c48300 #d56a93 #42ac3c
 *     lightness band PASS · chroma floor PASS
 *     CVD separation PASS (worst #14ac77↔#e76530 ΔE 9.2 deutan)
 *     normal vision  PASS (worst ΔE 17.4)
 *     contrast       PASS — all six clear 3:1
 *
 * The dark steps are chosen, not flipped. An inverted light palette lands
 * outside the dark lightness band (L 0.48–0.67) and fails on contrast.
 *
 * The relief obligation is why the donut ALWAYS renders a full legend with
 * the label, amount and share beside each swatch: identity is never carried
 * by colour alone. That legend is also what makes the six-slot cap honest —
 * on the all-pairs list (every slice visible at once, which a donut is) the
 * set does not separate, so the text is doing the identifying and the hue is
 * only helping you find the row.
 *
 * Slots are consumed in order and never cycled. Past six segments the tail
 * folds into "Other".
 */
export const CHART_SERIES = [
  'var(--color-chart-1)', // 1 blue
  'var(--color-chart-2)', // 2 orange
  'var(--color-chart-3)', // 3 aqua
  'var(--color-chart-4)', // 4 yellow
  'var(--color-chart-5)', // 5 magenta
  'var(--color-chart-6)', // 6 green
] as const;

/** Tail bucket. Deliberately neutral so it recedes behind the named slices. */
export const CHART_OTHER = 'var(--color-chart-other)';

/**
 * Payment split. Blue/orange rather than blue/aqua: the pair clears 3:1
 * contrast in both themes, where aqua does not on white.
 */
export const PAYMENT_COLORS = {
  ONLINE_BANKING: 'var(--color-chart-1)',
  CASH: 'var(--color-chart-2)',
} as const;

/** Single-series trend. One colour for every bar — never a value ramp. */
export const CHART_PRIMARY = 'var(--color-chart-1)';

/** Hairline grid, one step off the surface. Solid, never dashed. */
export const CHART_GRID = 'var(--color-chart-grid)';

/** The "nothing to show" ring — a shape where a chart would be. */
export const CHART_EMPTY = 'var(--color-chart-empty)';

/** Axis tick labels wear a text token, never a series colour. */
export const CHART_LABEL = 'var(--color-fg-subtle)';
