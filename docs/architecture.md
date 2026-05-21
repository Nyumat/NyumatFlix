# Architecture Notes

## Dependency Direction

- `app/*` owns routing, route handlers, metadata, and thin server-action
  compatibility entrypoints.
- `lib/server/*` owns reusable server-side data access, enrichment, watchlist,
  catalog, search, and media-detail services.
- `lib/domain/*` owns app-level schemas, inferred app types, guards, mappers,
  enums, and domain helpers.
- `tmdb/*` owns raw TMDB client helpers and raw TMDB wire types.
- `components/*` owns rendering and interaction. Reusable components should not
  import from `app/*`.

## Type Ownership

- Raw external API response shapes stay in `tmdb/models.ts` or focused modules
  under `tmdb`.
- Normalized app models and Zod schemas stay under `lib/domain`.
- Shared code should import app-domain types from `lib/domain`, not `utils`.

## Server And Client Boundaries

- Server actions in `app/*` should delegate to reusable implementation modules
  in `lib/server/*`.
- Client components may call server actions through stable public entrypoints,
  but shared libraries and reusable components should depend on `lib/server/*`
  or `lib/domain/*` instead of route folders.

## File Size

- Keep hand-authored TS/TSX files under roughly 500 lines.
- Static lookup data can exceed that size when splitting would reduce
  readability.
- When a file grows past the limit, split by behavior first: data access,
  transformation, rendering shell, controls, and presentational subcomponents.
