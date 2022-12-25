<h1 align="center"><img width="250" height="300" src="https://i.ibb.co/5GwHC6j/logo.png" alt="logo" border="0">

<p align="center">
	<img width="100" height="30" src="https://badges.aleen42.com/src/react.svg">
	<img width="100" height="30" src="https://badges.aleen42.com/src/node.svg">
	<!-- <img width="100" height="30" src="https://badges.aleen42.com/src/typescript.svg"> -->
	<img width="100" height="30" src="https://badges.aleen42.com/src/vitejs.svg">
	<img width="100" height="30" src="https://badges.aleen42.com/src/npm.svg">
</p>
	
</h1>

<!-- End header --->

<p align="center" style="font-size:40px;">
	Welcome to the official repository of NyumatFlix!
	<br>
	Made with ♡ by @Nyumat
	<br>
	This Project has been deployed with heroku 
	<a href="http://nyumat.tech"> here</a> 😄
</p>

<h1 align="center"> The Project </h1>
	
	

 <b><p align="center">
	Disclaimer:		This Project is for educational purposes only. None of the things done in this project are meant to harm, but simply demonstrate that it can be done.
	</p>
</b>


<!-- End Disclaimer--->

<h2 align="left"> So now, what is NyumatFlix? </h2>

<b><p align="left"> NyumatFlix is a free movie and tv show streaming platform. You can stream and download whatever TV epsiode or movie you'd like, all according to the [TMDB API](https://developers.themoviedb.org/3) </p></b>


<h2 align="left"> Why?</h2>

<p align="left"> As a college student, money is scarce. Nowadays, it seems like you need subsriptions to the popular streaming services just to keep up with all the shows/movies you'd like to see!</p>

<b><p align="left"> So naturally, I just had to make my own site.</p></b>

<p align="left">Growing up, I used sites such as soap2day and 123movies. However, I quickly found those sites to be infested with ads and viruses. You may say yeah, the bills have to be paid...but, what if I told you we could negate all of these risks?</p>

<h2 align="left">Inception</h2>

<p align="left"> And that's where NyumatFlix comes in. This term, I'm taking a web development course and wanted to explore what the Web Development hype really is all about.</p>

<br>

<p align="left">I creatd my first TypeScript and React project about a week ago, which was just a simple guessing game. I'm the type to see a new framework and just start messing with it, so that's exactly what I did.</p>


<h2 align="left"> The API</h2>

<p align="left"> You've probably heard of the movie databse before. It's the most popular REST api for querying data on any movie, really ever. I've used it in both Python and Swift before and wanted to see the actual data displayed, so, I used my newfound hook to TypeScript and React (pun intended) 😏 to create something where I could display the information.</p>

<!-- End General Content--->

<h2 align="left">Demo </h2>

<p align="left">I could ramble in the README for pretty much forever, as I don't have a Youtube channel or TikTok (anymore, rip TTB 😢) so I'm going to put the demo's in this Readme!</p>

<b><p align="left"> I'm not a pro in CSS or UI/UX design by any means, although I tried to make the UI as sleek as possible. Let's check it out!</p></b>

<!-- Demos--->

<h1 align="center">
	<p>TV Shows</p>
	<img src="img/tv_shows.gif">
	<p>Search</p>
	<img src="img/search_movie.gif">
	<p>Movies</p>
	<img src="img/movie_demo.gif">
	
</h1>


<h2 align="left"> Running NyumatFlix Locally</h2>

<!-- Run Locally (Dev)--->

In the command line, first do:

```bash
  git clone https://github.com/Nyumat/NyumatFlix.git
```

Then head to the directory:

```bash
  cd NyumatFlix
```
You'll need some enviornment variables.

You can grab an API key [here.](https://developers.themoviedb.org/3/getting-started/introduction) \
Format your .env file within the root dir like so:
```bash
REACT_APP_TMDB_API_KEY=
PORT=8080 <-- If you change this, alter the client/package.json as well
```

Next, install the required dependencies in the root and /client:  

```bash
  npm i && cd client && npm i
```
Navigate to the root directory and start the dev servers concurrently

```bash
  cd .. && npm run dev
```

<!-- Wish List--->

<h2 align="left">Wish List for NyumatFlix</h2>


- [ ] Search Autosuggest/complete
- [x] Server Side with Node.js & Express
- [ ] Filter of Search and Results
- [ ] Revamped Landing Page
- [x] TV Show Episode and Season Selector
- [ ] SSR 
