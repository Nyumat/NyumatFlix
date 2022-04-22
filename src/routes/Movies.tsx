import { useEffect, useState } from "react";
import logo from "./logo.svg";
import "../routes/Movies.css";
import { Route, BrowserRouter, Link } from "react-router-dom";

function Movies() {

      const [data, setData] = useState<any>([]);

      const getMovies = async () => {
            const response = await fetch("https://api.themoviedb.org/3/movie/popular?api_key=[your_api_key]=en-US&page=1");
            const data = await response.json();
            if (data.Search) {
                  setData(data);
            } else {
                  setData(data.results);
            }
      }

      useEffect(() => {
              getMovies();
                  }, [])


  return (
    <div>
      <header>
      <h1 id="route-header">Movies</h1>
      </header>

      <div>
            <ul>
                  <li className="header popular">Popular Movies</li>
                  <li className="header latest">Latest Movies</li>
                  <li className="header upcoming">Upcoming Movies</li>
            </ul>
      </div>

      <div className="movie-container">
            <ul className="list">
                  {data.map((movie: any) => <img className="item" key={movie.id} src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}></img>)}
            </ul> 
      </div>
    </div>
  );
}

export default Movies;
