<img src="preview.png" alt="NyumatFlix" width="100%"/>

# [NyumatFlix](https://nyumatflix.com)

Welcome to the NyumatFlix repository! NyumatFlix is a streaming platform that allows you to watch your favorite movies and TV shows. The app is built with Next.js, TypeScript, and Tailwind CSS. It uses The Movie Database (TMDb) API to fetch movie and TV show data.

## 🚀 Features 🚀

- 🎞️ **Multi-modal Streaming:** Anime, TV shows, Movies, we got you covered.
- 🎬 **Latest Releases:** Stay up to date with the latest movie and TV show releases.
- 🔍 **Search:** Find your favorite movies and TV shows with the search feature.
- 🎭 **Filter by Genre:** Filter movies and TV shows by genre.
- 📱 **Responsive Design:** The app is designed to work well on both desktop and mobile devices.

## ⚡️ Tech Stack ⚡️

- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Jest](https://jestjs.io/)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)
- [Husky](https://typicode.github.io/husky/#/)
- [Mantine](https://mantine.dev/)
- [Framer Motion](https://www.framer.com/motion/)
- [Tabler Icons](https://tablericons.com/)

## 🏃🏾‍♂️ Run NyumatFlix Locally 🏃🏾‍♂️

To install the project, follow these steps:

1. Clone the repository

```bash
git clone https://github.com/Nyumat/NyumatFlix.git
```

2. Create a `.env.local` file in the root directory of the project and add the following environment variables:

```bash
# The API key for The Movie Database (TMDb)
API_KEY=
# First is for movies, second one is for TV shows. Both are required.
NYUMATFLIX_VPS=
NYUMATFLIX_VPS2=
```

I purposely left the API key blank so that you can get your own. You can get one by creating an account on [TMDb](https://www.themoviedb.org/). For the other two variables, you can get them by checking out [FMHY](https://fmhy.net/).

3. Install dependencies

```bash
npm install
```

4. Run the development server

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📝 Scripts 📝

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

## 🤝 Contributing 🤝

Contributions are welcome. I'm currently working on a test suite so that contributions can be made easier without breaking NyumatFlix. If you have any questions, feel free to open an issue.

## 📄 License 📄

[MIT](LICENSE)
