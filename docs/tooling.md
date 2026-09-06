# Tooling

`pnpm` manages dependencies and scripts.

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | Starts Vite                                |
| `pnpm build`        | `tsc -b` then the production Vite build    |
| `pnpm lint`         | Oxlint                                     |
| `pnpm format`       | Writes Oxfmt changes                       |
| `pnpm format:check` | Verifies formatting without changing files |
| `pnpm preview`      | Serves the production build locally        |

## StyleX

StyleX is configured through `@stylexjs/unplugin` in `vite.config.ts`. Keep the plugin before
the React plugin, or the build fails.

## Lint constraints worth knowing

The React compiler lint rejects `try`/`finally` and any ref read that is not plainly inside an
event handler. That is why the sketch page's export is split into `renderAndSave` and
`exportPng`, and why the file-picker buttons are written out rather than built through the
`button` helper.

## Deploying

Cloudflare Workers, built from the GitHub repo by Workers Builds. Pages would work equally well
for a site with no server code; Workers is where the dashboard's import flow leads and where the
tooling is being developed.

- `wrangler.jsonc` points the deploy at `./dist`. There is no Worker script, so no bindings.
- `not_found_handling` is `single-page-application`, so `/sketch` returns `index.html` with a 200
  instead of a 404 — there is no `sketch.html`, and the path check lives in `App.tsx`. On Pages
  this same job is done by a `public/_redirects` file.
- `.node-version` pins Node for the build image; a `NODE_VERSION` build variable in the
  dashboard would override it. pnpm's version comes from `packageManager` in `package.json`.
- Build command `pnpm build`, deploy command `npx wrangler deploy`.
- `npx wrangler deploy --dry-run` validates the config without shipping.

## Deliberately not used

- TanStack tooling.
- p5. The generative code is built directly on the Canvas 2D API.
