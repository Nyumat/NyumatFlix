const dotenv = require('dotenv');
const cors = require('cors');
const express = require('express');
const axios = require('axios');


const app = express();

app.use(cors());

dotenv.config();


app.use(function (req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
});

// Get the newest movies
app.get("/api/latest", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/movie/now_playing?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}`)
            .then(response => {
                  res.send(response.data.results);
            }).catch(err => {
                  res.send(err);
            });

});

// Get the top movies
app.get("/api/top", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/movie/top_rated?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}`)
            .then(response => {
                  res.send(response.data.results);
            }).catch(err => {
                  res.send(err);
            });
});

// Get the popular movies
app.get("/api/popular", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}`)
            .then(response => {
                  res.send(response.data.results);
            }).catch(err => {
                  res.send(err);
            });
});

// Get a tvshow by id
app.get("/api/tvshow", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/tv/${req.query.tvId}?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}`)
            .then(response => {
                  res.send(response.data);
            }).catch(err => {
                  res.send(err);
            });
});

// Get a tvshow's seasons/episodes by ID
app.get("/api/seasons", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/tv/${req.query.tvId}?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}`)
            .then(response => {
                  res.send(response.data);
            }).catch(err => {
                  res.send(err);
            });
});

app.get("/api/movie", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/movie/${req.query.movieId}?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}`)
            .then(response => {
                  res.send(response.data);
            }).catch(err => {
                  res.send(err);
            });
});

app.get("/api/search", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&query=${req.query.searchTerm}&page=${req.query.searchPage}`)
            .then(response => {
                  res.send(response.data);
            }).catch(err => {
                  res.send(err);
            });
});

app.get("/api/tvshows/popular", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/tv/popular?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}&origin_country=US`)
            .then(response => {
                  res.send(response.data.results);
            }).catch(err => {
                  res.send(err);
            });            
});

app.get("/api/tvshows/airing", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/tv/airing_today?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}&origin_country=US`)
            .then(response => {
                  res.send(response.data.results);
            }).catch(err => {
                  res.send(err);
            });
});

app.get("/api/tvshows/toprated", (req, res) => {
      req.query.page = req.query.page || 1;
      axios.get(`https://api.themoviedb.org/3/tv/top_rated?api_key=${process.env.REACT_APP_TMDB_API_KEY}&language=en-US&page=${req.query.page}&origin_country=US`)
            .then(response => {
                  res.send(response.data.results);
            }).catch(err => {
                  res.send(err);
            });
});

if (process.env.NODE_ENV === 'production') {    
      app.use(express.static('client/build'));
      const path = require('path');
      app.get('*', (req, res) => {
            res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
      }
      );
}

const PORT = process.env.PORT;
app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
      console.log(`TMDB API Key: ${process.env.REACT_APP_TMDB_API_KEY}`)
});

