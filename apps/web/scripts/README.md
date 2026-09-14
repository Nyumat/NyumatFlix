# Maintenance scripts

## Refresh the collections catalog

Run this occasionally when the static catalog needs new franchises:

```sh
bun run --cwd apps/web collections:refresh
```

The command downloads TMDB's daily collection ID export, fetches collection
details in bounded batches, keeps collections with at least four released
movies and a popularity score above 5, and writes the reviewed snapshot to
`apps/web/data/collections/catalog.json`.

Use `bun run --cwd apps/web collections:seed` for a quick local refresh from
the existing seed IDs.
