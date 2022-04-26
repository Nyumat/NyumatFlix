import { useEffect, useReducer, useState } from "react";
import "./Movies.css";
import {Link} from "react-router-dom";


function Movies() {
      const [popularData, setPopularData] = useState<any>([]);
      const [upcomingData, setUpcomingData] = useState<any>([]);
      const [latestData, setLatestData] = useState<any>([]);

      const getPopularMovies = async () => {
            const response = await fetch("https://api.themoviedb.org/3/movie/top_rated?api_key=[your_api_key]9&language=en-US&page=1");
            const data = await response.json();
            if (data.Search) {
                  setPopularData(data);
            } else {
                  setPopularData(data.results);
            }
      }



      const getUpcomingMovies = async () => {
            try {
                  const response = await fetch("https://api.themoviedb.org/3/movie/upcoming?api_key=[your_api_key]9&language=en-US&page=1");
                  const data = await response.json();
                  if (data.Search) {
                        setUpcomingData(data);
                  } else {
                        setUpcomingData(data.results);
                  }
            } catch (error) {
                  console.log(error);
            }
      }

      const getLatestMovies = async () => {
            try {
                  const response = await fetch("https://api.themoviedb.org/3/movie/now_playing?api_key=[your_api_key]9&language=en-US&page=1");
                  const data = await response.json();
                  if (data.Search) {
                        setLatestData(data);
                  } else {
                        setLatestData(data.results);
                  }
            } catch (error) {
                  console.log(error);
            }
      }

      useEffect(() => {getLatestMovies(); getPopularMovies(); getUpcomingMovies();}, [])

      const getMoviePlayerOnClick = (movieId: number) => {
            window.location.href = `/movies/${movieId}`;
      }


  return (
      <div>

            <Link to="/">
                  <h1 className="movie-section-header">Movie Section</h1>
            </Link>

            <div>
                  <ul>
                        <li className="header popular">Popular Movies</li>
                        <li className="header latest">Latest Movies</li>
                        <li className="header upcoming">Upcoming Movies</li>
                  </ul>
            </div>

            

            <div className="movie-container">
                  <ul className="list popular">
                        {popularData.map((movie: any) => <img className="item" key={movie.id} src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} onClick={() => getMoviePlayerOnClick(movie.id)}></img>)}
                  </ul> 
                  <ul className="list upcoming">
                        {upcomingData.map((movie: any) => <img className="item" key={movie.id} src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} onClick={() => getMoviePlayerOnClick(movie.id)}></img>)}
                  </ul>

                  <ul className="list latest">
                        {latestData.map((movie: any) => <img className="item" key={movie.id} src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} onClick={() => getMoviePlayerOnClick(movie.id)}></img>)}
                  </ul>
            </div>

      </div>
    
  );
}

export default Movies;
