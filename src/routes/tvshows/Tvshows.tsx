import { useEffect, useState } from "react";
import "./Tvshows.css";
import {Link} from "react-router-dom";

function Tvshows() {

      const [popularTv, setPopulatTv] = useState<any>([]);
      const [topRatedTv, setTopRatedTv] = useState<any>([]);
      const [airingTv, setAiringTv] = useState<any>([]);

      const getPopularTv = async () => {
            const response = await fetch("https://api.themoviedb.org/3/tv/popular?api_key=[your_api_key]9&language=en-US&page=5&origin_country=US");
            const data = await response.json();
            if (data.Search) {
                  setPopulatTv(data);
            } else {
                  setPopulatTv(data.results);
            }
      }

      const getTopRatedTv = async () => {
            const response = await fetch("https://api.themoviedb.org/3/tv/top_rated?api_key=[your_api_key]9&language=en-US&page=1");
            const data = await response.json();
            if (data.Search) {
                  setTopRatedTv(data);
            } else {
                  setTopRatedTv(data.results);
            }
      }

      const getAiringTv = async () => {
            const response = await fetch("https://api.themoviedb.org/3/tv/on_the_air?api_key=[your_api_key]9&language=en-US&page=3");
            const data = await response.json();
            if (data.Search) {
                  setAiringTv(data);
            } else {
                  setAiringTv(data.results);
            }
      }

      useEffect(() => {getPopularTv(); getTopRatedTv(); getAiringTv();}, [])
      useEffect(() => {getPopularTv(); getTopRatedTv(); getAiringTv();}, [popularTv, topRatedTv, airingTv])

      const getTvPlayerOnClick = (tvId: number) => {
            window.location.href = `/tvshows/${tvId}`;
      }


  return (
      <div>
            
            <Link to="/">
                  <h1 className="tv-section-header">Televison Section</h1>
            </Link>

            <div>
                  <ul>
                        <li className="header popular">Popular TV Shows</li>
                        <li className="header airing">Airing Right Now</li>
                        <li className="header toprated">Top Rated Shows</li>
                  </ul>
            </div>

            <div className="movie-container">
                  <ul className="list popular">
                        {popularTv.map((show: any) => <img className="item" key={show.id} src={`https://image.tmdb.org/t/p/w500${show.poster_path}`} onClick={() => getTvPlayerOnClick(show.id)} ></img>)}
                  </ul> 
                  <ul className="list toprated">
                        {topRatedTv.map((show: any) => <img className="item" key={show.id} src={`https://image.tmdb.org/t/p/w500${show.poster_path}`} onClick={() => getTvPlayerOnClick(show.id)} ></img>)}
                  </ul>

                  <ul className="list airing">
                        {airingTv.map((show: any) => <img className="item" key={show.id} src={`https://image.tmdb.org/t/p/w500${show.poster_path}`} onClick={() => getTvPlayerOnClick(show.id)} ></img>)}
                  </ul>
            </div>

      </div>
    
  );
}

export default Tvshows
