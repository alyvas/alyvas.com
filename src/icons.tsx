import type { ComponentType, SVGProps } from 'react';

/** The shared type of Iconoir's icons and the ones drawn here. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Iconoir has no stethoscope, so this one is drawn to match the rest: a 24 grid, 1.5 stroke on
 * `currentColor`, round caps and joins, nothing filled.
 */
export const Stethoscope: IconComponent = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Ear tubes. */}
    <path d="M4 2.5v3.5a4.5 4.5 0 0 0 9 0V2.5" />
    {/* Tube down to the chest piece, leaving the binaural at its lowest point. */}
    <path d="M8.5 10.5v3a4.5 4.5 0 0 0 4.5 4.5" />
    <circle cx="16.5" cy="18" r="3.5" />
  </svg>
);
