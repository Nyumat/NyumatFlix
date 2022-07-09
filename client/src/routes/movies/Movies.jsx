/* eslint-disable jsx-a11y/img-redundant-alt */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import "./Movies.css";
import { Link } from "react-router-dom";
import Spinner from "../../components/Spinner"

function Movies() {
  const [popularData, setPopularData] = useState([]);
  const [upcomingData, setUpcomingData] = useState([]);
  const [latestData, setLatestData] = useState([]);

  const [popularPageQuery, setPopularPageQuery] = useState(1);
  const [upcomingPageQuery, setUpcomingPageQuery] = useState(1);
  const [latestPageQuery, setLatestPageQuery] = useState(1);

  const [popLoading, setPopLoading] = useState(true);
  const [upLoading, setUpLoading] = useState(true);
  const [latLoading, setLatLoading] = useState(true);

  const getPopularPageOnClick = (page) => {
    if (page < 1) {
      setPopularPageQuery(1);
    } else {
      setPopularPageQuery(page);
    }
  };

  const getUpcomingPageOnClick = (page) => {
    if (page < 1) {
      setUpcomingPageQuery(1);
    } else {
      setUpcomingPageQuery(page);
    }
  };

  const getLatestPageOnClick = (page) => {
    if (page < 1) {
      setLatestPageQuery(1);
    } else {
      setLatestPageQuery(page);
    }
  };

  const getPopularMovies = async () => {
    setPopLoading(true);
    fetch(`/api/popular?page=${popularPageQuery}`)
      .then((res) => res.json())
      .then((data) => setPopularData(data))
      .then(() => setPopLoading(false));
  };

  const getUpcomingMovies = async () => {
    setUpLoading(true);
    fetch(`/api/top?page=${upcomingPageQuery}`)
      .then((res) => res.json())
      .then((data) => setUpcomingData(data))
      .then(() => setUpLoading(false));
  };

  const getLatestMovies = async () => {
    setLatLoading(true);
    fetch(`/api/latest?page=${latestPageQuery}`)
      .then((res) => res.json())
      .then((data) => setLatestData(data))
      .then(() => setLatLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    getLatestMovies();
  }, [latestPageQuery]);

  useEffect(() => {
    getPopularMovies();
  }, [popularPageQuery]);

  useEffect(() => {
    getUpcomingMovies();
  }, [upcomingPageQuery]);


  

  const getMoviePlayerOnClick = (movieId) => {
    window.location.href = `/movies/${movieId}`;
  };



    
      
  return (
    <div>
      <Link to="/">
        <h1 className="movie-section-header">Movies</h1>
      </Link>

      <div>
        <ul>
          <li className="header popular">Popular Movies</li>
          <li className="header latest">Latest Movies</li>
          <li className="header top">Top Movies (IMDB)</li>
        </ul>
      </div>

      <div className="movie-container">
        <div className="pagination popular">
          <div
            className="load-more-left"
            onClick={() => getPopularPageOnClick(popularPageQuery - 1)}
          >
          </div>
          <div
            className="load-more"
            onClick={() => getPopularPageOnClick(popularPageQuery + 1)}
          ></div>
          <label>
            {popLoading ? <Spinner/>: `${popularPageQuery}`}
          </label>
        </div>
        <ul className="list popular">
          {popularData.map((movie) => (
            <img
              className="item "
              alt={movie.backdrop_path}
              key={movie.id}
              src={
                movie.backdrop_path !== null &&
                `https://image.tmdb.org/t/p/w500${
                  movie.poster_path ? movie.poster_path : movie.backdrop_path
                }`
              }
              onClick={() => getMoviePlayerOnClick(movie.id)}
            ></img>
          ))}
        </ul>
        <div className="pagination top">
          <div className="load-more-left" onClick={() => getUpcomingPageOnClick(upcomingPageQuery - 1)}>
          </div>
          <div className="load-more" onClick={() => getUpcomingPageOnClick(upcomingPageQuery + 1)}>
          </div>
          <label>
            {upLoading ? <Spinner/> : `${upcomingPageQuery}`}
          </label>
        </div>
        <ul className="list top">
          {upcomingData.map((movie) => (
            <img
              className="item"
              alt={movie.backdrop_path}
              key={movie.id}
              src={
                movie.backdrop_path !== null &&
                `https://image.tmdb.org/t/p/w500${
                  movie.poster_path ? movie.poster_path : movie.backdrop_path
                }`
              }
              onClick={() => getMoviePlayerOnClick(movie.id)}
            ></img>
          ))}
        </ul>

        <div className="pagination latest">
          <div className="load-more-left" onClick={() => getLatestPageOnClick(latestPageQuery - 1)}>
          </div>
          <div className="load-more" onClick={() => getLatestPageOnClick(latestPageQuery + 1)}>
          </div>
          <label>
            {latLoading ? <Spinner/> : `${latestPageQuery}`}
          </label>
        </div>
        <ul className="list latest">
          {latestData.map((movie) => (
            <img
              className="item"
              alt={movie.backdrop_path}
              key={movie.id}
              src={
                movie.backdrop_path !== null &&
                `https://image.tmdb.org/t/p/w500${
                  movie.poster_path ? movie.poster_path : movie.backdrop_path
                }`
              }
              onClick={() => getMoviePlayerOnClick(movie.id)}
            ></img>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Movies;
