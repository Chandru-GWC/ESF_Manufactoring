import { Transition, Variants } from 'motion/react';

/**
 * Precision Motion Constants (Adapted from Emil Kowalski's UI Motion Standard)
 * - No ease-in (sluggish feel); strictly ease-out deceleration curves.
 * - Sub-220ms timing for product interfaces; exits faster than entrances.
 * - Never scale from 0 (use 0.97 -> 1.0 + opacity).
 * - Animate compositor properties (transform, opacity) only.
 */

export const EHS_EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EHS_EASE_MODAL: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const PAGE_TRANSITION: Transition = {
  duration: 0.14,
  ease: EHS_EASE_OUT,
};

export const PAGE_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: PAGE_TRANSITION },
  exit: { opacity: 0, y: -2, transition: { duration: 0.1, ease: EHS_EASE_OUT } },
};

export const MODAL_TRANSITION: Transition = {
  duration: 0.16,
  ease: EHS_EASE_MODAL,
};

export const MODAL_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: MODAL_TRANSITION },
  exit: { opacity: 0, scale: 0.97, y: 2, transition: { duration: 0.12, ease: EHS_EASE_OUT } },
};

export const DRAWER_TRANSITION: Transition = {
  duration: 0.2,
  ease: EHS_EASE_MODAL,
};

export const NAV_PILL_SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
};

