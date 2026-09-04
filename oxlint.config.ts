import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';

const reactNoA11y = {
  ...react,
  plugins: (react.plugins ?? []).filter((p: string) => p !== 'jsx-a11y'),
  rules: Object.fromEntries(
    Object.entries(react.rules ?? {}).filter(([key]) => !key.startsWith('jsx-a11y/'))
  ),
};

export default defineConfig({
  $schema: './node_modules/oxlint/configuration_schema.json',
  categories: {
    correctness: 'error',
  },
  env: {
    builtin: true,
  },
  extends: [reactNoA11y],
  ignorePatterns: [...(core.ignorePatterns ?? []), 'apps/art/src/sketches/**'],
  plugins: ['typescript', 'unicorn', 'oxc'],
  rules: {},
});
