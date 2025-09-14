![NyumatFlix](/public/preview.webp)

# [NyumatFlix](https://nyumatflix.com)

The successor to NyumatFlix V2. Now including shadcn-ui, more servers, and a better design.

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

## 🏃🏾‍♂️ Run NyumatFlix Locally

> [!IMPORTANT]
> Prerequisites:
>
> - [Bun](https://bun.sh/) installed on your machine.
> - A [PostgreSQL](https://www.postgresql.org/) database.
> - A [TMDb](https://www.themoviedb.org/) API key.
> - A [Resend](https://resend.com/) API key.
> - A [GitHub OAuth App](https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app) created.

To run the project on your machine, follow the steps below:

1. Clone the repository

```bash
git clone https://github.com/Nyumat/NyumatFlix.git
cd NyumatFlix
```

2. Next, create a `.env.local` file in the root directory of the project and add the following environment variables:

```bash
TMDB_API_KEY=
AUTH_RESEND_KEY=
AUTH_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
PROD_DATABASE_URL=
DATABASE_URL=
```

> [!WARNING]
> NyumatFlix won't work without these environment variables. You can remove them, but please note, you will **lose anything related to database access**.

3. Install dependencies

```bash
bun install
```

4. Configure magic strings

There's a few places in the codebase where I'm hardcoding some strings that you might want to change. You can find some of them in `lib/constants.ts`. Additionally, you might want to modify the email templates in `emails/` and `metadata` objects in `app/` and `layout/`.

If you end up not changing the magic strings, that's fine too, but I'd appreciate credit if you use NyumatFlix without modifications. [License](LICENSE)

5. Set up the database

```bash
bun run db:generate
bun run db:push
bun run db:studio # optional
```

This will generate the necessary migration files and push the schema to your PostgreSQL database. You can also use `bun run db:studio` to open Drizzle's database studio to visualize the DB internals.

6. Run the development server

```bash
bun run dev
```

7. Finally, open [http://localhost:3000](http://localhost:3000) in your browser to see NyumatFlix in action!

## 📝 Scripts

| Script         | Description                                                          |
| -------------- | -------------------------------------------------------------------- |
| `dev`          | Run Next.js development server.                                      |
| `build`        | Build the Next.js application.                                       |
| `start`        | Start the Next.js production server.                                 |
| `preview`      | Start the Next.js server on port 3001 for previewing.                |
| `format`       | Format code using Prettier for specified file patterns.              |
| `check-format` | Check if code is formatted correctly using Prettier.                 |
| `type-check`   | Run TypeScript type-checking using the `tsc` compiler.               |
| `lint`         | Lint code using ESLint for TypeScript and TypeScript React files.    |
| `lint:fix`     | Fix linting issues using ESLint for TypeScript and TypeScript React. |
| `test-all`     | Run type-checking, linting, and code formatting checks.              |
| `prepare`      | Install Husky Git hooks.                                             |
| `db:generate`  | Generate a new migration file based on schema changes.               |
| `db:push`      | Push the current schema to the database without a migration file.    |
| `db:studio`    | Open Drizzle's database studio for managing the database.            |
| `db:migrate`   | Apply pending migrations to the database.                            |

## 🤝🏿 Contributing

Contributions, feedback, and suggestions are always welcome. If you have any questions, feel free to open an issue. I can't guarantee I'll be able to address everything as a solo dev (on top of juggling other commitments), but I'll do my best!

## 🙏🏿 Support the project

If you find NyumatFlix useful, consider [buying me a coffee](https://buymeacoffee.com/nyumat) or starring the repo. Lastly, since I know there's a ton of people skidding this repo, please at least mention me as the original pioneer. Thanks!
