/**
 * Central brand configuration.
 * Temporary text-based branding — replace `logoSrc` (and optionally the text) once the
 * official GWC logo is supplied. Every header / footer reads from here.
 */
export const BRAND = {
  productName: 'EHS Safety AI',
  organisation: 'GWC Data',
  /** Path to the official logo image (e.g. '/media/gwc-logo.svg'). `null` = text brand. */
  logoSrc: '/logo.png' as string | null,
} as const;
