/**
 * Chart palette.
 *
 * These are not arbitrary hexes — the set was run through a colour-vision
 * validator and passes the lightness band, chroma floor, adjacent-pair CVD
 * separation (worst ΔE 9.1, target ≥8) and the normal-vision floor
 * (worst ΔE 19.6, floor ≥15) against a white surface.
 *
 * Three of the six sit below 3:1 contrast on white, which obligates "relief":
 * every chart using them ships visible labels beside the mark, never colour
 * alone. That is why the donut always renders a full legend list with the
 * amount next to each swatch rather than relying on the ring itself.
 *
 * Slots are consumed in order and never cycled. Past six segments the tail
 * folds into "Other" — a seventh generated hue would be indistinguishable
 * from an existing slot under colour-vision deficiency.
 */
export const CHART_SERIES = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
] as const;

/** Tail bucket. Deliberately neutral so it recedes behind the named slices. */
export const CHART_OTHER = '#94a3b8';

/**
 * Payment split. Blue/orange rather than blue/aqua: the pair clears 3:1
 * contrast on white with no warning, where aqua does not.
 */
export const PAYMENT_COLORS = {
  ONLINE_BANKING: '#2a78d6',
  CASH: '#eb6834',
} as const;

/** Single-series trend. One colour for every bar — never a value ramp. */
export const CHART_PRIMARY = '#2a78d6';

/** Hairline grid, one step off the surface. Solid, never dashed. */
export const CHART_GRID = '#e2e8f0';
export const CHART_SURFACE = '#ffffff';
