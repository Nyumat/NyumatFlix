![NyumatFlix](/public/preview.webp)

<div align="center">
  <h3 style="font-size: 3rem; font-weight: 600;"><a href="https://nyumatflix.com">NyumatFlix</a></h3>
  <p><em>Yet another Anilist and TMDB metadata aggregator.</em></p>
</div>




<!-- NyumatFlix is a platform for streaming movies and TV shows. It is a open-source, no-cost, and ad-free movie and tv show stream aggregator. Streams are curated from some of the most popular API providers.

## ⚡️ Tech Stack

- [Bun](https://bun.sh/)
- [Next.js](https://nextjs.org/)
- [Resend](https://resend.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Postgres](https://www.postgresql.org/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Husky](https://typicode.github.io/husky/#/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Jest](https://jestjs.io/)
- [NextAuth.js](https://next-auth.js.org/)
- [TMDb API](https://www.themoviedb.org/documentation/api)
- [Biome](https://biomejs.dev/) -->

## 🏃🏾‍♂️ Run NyumatFlix Locally

> [!IMPORTANT]
> Prerequisites:
>
> - [Bun](https://bun.sh/) installed on your machine.
> - A [PostgreSQL](https://www.postgresql.org/) database.
> - A [TMDb](https://www.themoviedb.org/) API key.
> - A [Resend](https://resend.com/) API key.

To run the project on your machine, follow the steps below:

1. Clone or fork the repository

```bash
git clone git@github.com:Nyumat/NyumatFlix.git
cd NyumatFlix
```

2. Next, create a `.env.local` file in the root directory of the project and add the following environment variables:

```bash
TMDB_API_KEY=
ID_MOE_API_KEY=
AUTH_SECRET=
AUTH_RESEND_KEY=
AUTH_URL=
NEXTAUTH_URL=
NEXT_PUBLIC_APP_URL=
RESEND_FROM_EMAIL=
DATABASE_URL=
```

You can get your own instance of the API keys by creating an account on [TMDb](https://www.themoviedb.org/) and [Resend](https://resend.com/).

> [!TIP]
> For the database, you can use any PostgreSQL database you want. I recommend using [Neon](https://neon.tech/) for production and [Local Postgres](https://www.postgresql.org/) for development.

For local development, set `AUTH_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_APP_URL` to `http://localhost:3000`.

3. Install dependencies

Bun is the package manager of choice here, so you'll need to install it first. You can do so by following the instructions [here](https://bun.sh/docs/installation).

```bash
bun install
```

4. Configure magic strings

There's a few places in the codebase where I'm hardcoding some strings that you might want to change. You can find some of them in `lib/constants.ts`. Additionally, you might want to modify the email templates in `emails/` and `metadata` objects in `app/` and `layout/`.

> [!NOTE]
> If you end up not changing the magic strings, that's fine too, but I'd appreciate credit if you re-deploy the project without modifications!

5. Set up the database

```bash
bun run db:generate
bun run db:push
bun run db:studio # tbh this is optional
```

These will generate the necessary migration files and push the schema to your local (or remote) PostgreSQL database instance.

6. Run the development server

```bash
bun run dev
```

7. Finally, open [http://localhost:3000](http://localhost:3000) in your browser to see the project in action!


## 🐳 Run with Docker

For our Docker friends, keep your variables in `.env.local`, then run:

```bash
docker compose up --build
```

The app will be available at [http://localhost:8080](http://localhost:8080). To use a different port:

```bash
APP_PORT=3001 docker compose up --build
```

To use a different env file:

```bash
APP_ENV_FILE=.env.production docker compose up --build
```

The `docker-compose.yml` sets `AUTH_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_APP_URL` to the local Docker URL by default. Override `APP_AUTH_URL`, `APP_NEXTAUTH_URL`, or `APP_PUBLIC_URL` if you need a different callback/public URL.

## FAQ

### How do I add a new stream provider?

Stream providers (the HTTP APIs) are the services that actually serve the video content. To add a new stream provider, you need to add it to the `videoServers` array in `lib/stores/server-store.ts`.

Each stream provider must implement the `VideoServer` interface, which includes:

- `id`: A unique identifier for the provider (e.g., `"vidsrc"`)
- `name`: Display name for the provider (e.g., `"VidSrc"`)
- `baseUrl`: Base URL of the provider's service
- `getMovieUrl(tmdbId)`: Function that returns the embed URL for a movie
- `getTvUrl(tmdbId)`: Function that returns the embed URL for a TV show
- `getEpisodeUrl(tmdbId, season, episode)`: Function that returns the embed URL for a specific episode
- Optional: `getAnimeUrl`, `getAnimePaheUrl`, `getVidnestUrl` for anime support
- Optional: `checkAvailability` and `checkIndividualAvailability` for availability checking

Here's an example of adding a new provider:

```typescript
{
  id: "myprovider",
  name: "My Provider",
  baseUrl: "https://myprovider.com",
  getMovieUrl: (tmdbId) => `https://myprovider.com/embed/movie/${tmdbId}`,
  getTvUrl: (tmdbId) => `https://myprovider.com/embed/tv/${tmdbId}`,
  getEpisodeUrl: (tmdbId, season, episode) =>
    `https://myprovider.com/embed/tv/${tmdbId}?s=${season}&e=${episode}`,
}
```

Add this object to the `videoServers` array in `lib/stores/server-store.ts`. The provider will automatically be available in the application's server selection UI.

### How do I sign-in locally?

When running the application in development mode (`NODE_ENV=development`), authentication works differently than in production:

1. **Start the development server**:
   ```bash
   bun run dev
   ```

2. **Navigate to the login page** at `http://localhost:3000/login`

3. **Enter your email address** and submit the form

4. **Check your terminal/console** - Instead of sending an email, the magic link will be logged directly to your terminal with a formatted output like this:

   ```
   ============================================================
   🔐 MAGIC LINK FOR DEVELOPMENT
   ============================================================
   📧 Email: your-email@example.com
   🔗 Magic Link: http://localhost:3000/api/auth/callback/resend?...
   ============================================================
   ⚠️  Development mode: Email not sent. Use the link above to sign in.
   ============================================================
   ```

5. **Automatic redirect** - In development mode, there's a btn that will redirect you to the callback URL and sign you in. The link is also logged to the terminal in case you need to manually access it or if the redirect doesn't work.

> [!NOTE]
> In production, magic links are still sent via email using Resend. The development mode bypasses email sending for convenience during local development.

## 📝 Scripts

| Script         | Description                                                          |
| -------------- | -------------------------------------------------------------------- |
| `dev`          | Run Next.js development server.                                      |
| `build`        | Build the Next.js application.                                       |
| `start`        | Start the Next.js production server.                                 |
| `format`       | Format code using Biome.                                             |
| `check-format` | Check formatting using Biome.                                        |
| `type-check`   | Run TypeScript type-checking using the `tsc` compiler.               |
| `lint`         | Run Biome checks.                                                    |
| `lint:fix`     | Fix Biome issues where possible.                                     |
| `test-ci`      | Run the Vitest suite once.                                           |
| `test`         | Run Vitest in watch mode.                                            |
| `precommit`    | Run formatting, linting, and type-checking.                          |
| `prepare`      | Install Husky Git hooks.                                             |
| `db:generate`  | Generate a new migration file based on schema changes.               |
| `db:push`      | Push the current schema to the database without a migration file.    |
| `db:studio`    | Open Drizzle's database studio for managing the database.            |
| `db:migrate`   | Apply pending migrations to the database.                            |

## 🤝🏿 Contributing

Contributions, feedback, and suggestions are always welcome here. Please, if you have any sort of inquiry, feel free to open an issue!

## 🙏🏿 Support the project

If you find the project useful, consider starring the repo! I appreciate all the support and feedback I've received from the community over the years developing this project.
