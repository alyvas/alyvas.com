import type { Palette } from './GradientCanvas';

/**
 * Colour sets for the background and the piece. Colours are painted in array order, so accents
 * come last; there are no near-whites, because the paper colour supplies the light tones.
 */
export const PALETTES: Palette[] = [
  {
    name: 'lilac',
    colors: ['#e2d9f5', '#f7cbbf', '#f8dfae', '#bfb0f1', '#9a92ee', '#7684e6'],
    paper: '#fbf8f4',
    ink: '#3a2d52',
  },
  {
    name: 'dawn',
    colors: ['#dfe4f0', '#f6d3b0', '#c3cbe6', '#f0a97f', '#e46a4f', '#efc35a'],
    paper: '#f9efe1',
    ink: '#4a3630',
  },
  {
    name: 'petal',
    colors: ['#ececec', '#fbd3c2', '#f6b6c6', '#f4a081', '#5d86dc', '#3f6fd3'],
    paper: '#f5f3f0',
    ink: '#2c3752',
  },
  {
    name: 'ember',
    colors: ['#f8dcc8', '#f5b9a4', '#f9e37a', '#f3a08a', '#f7d233', '#fb8f8a'],
    paper: '#fdf0e0',
    ink: '#5a3626',
  },
  {
    name: 'tide',
    colors: ['#b9d3f3', '#f8d0c2', '#5f8fe0', '#f36f9a', '#ef4d3d', '#1e5fc6'],
    paper: '#f6f0e9',
    ink: '#19264a',
  },
  {
    name: 'slate',
    colors: ['#c4bcb7', '#f5c9b0', '#9d9794', '#f6b18a', '#f47a49', '#2b87d9'],
    paper: '#ebe5dd',
    ink: '#2a2930',
  },
];
