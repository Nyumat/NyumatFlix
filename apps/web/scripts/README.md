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

## Scrub adult collections from the catalog

The generator's adult-content filter only sees what TMDB exposes on the
collection endpoint. To purge adult collections from an existing catalog
(pinku/erotic franchises that slip past the `adult` flag), run:

```sh
bun run --cwd apps/web collections:scrub
```

The script checks each movie's TMDB keywords for adult terms, drops any
collection where at least half the parts are flagged (or the collection
name matches adult terms), and writes the cleaned catalog back. Results
are cached in `data/collections/adult-keyword-cache.json`.
