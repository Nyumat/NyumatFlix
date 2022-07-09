/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import "./Tvshows.css";
import "../movies/Movies.css";
import {Link} from "react-router-dom";
import Spinner from "../../components/Spinner";

function Tvshows() {


      const [popularTv, setPopularTv] = useState([]);
      const [topRatedTv, setTopRatedTv] = useState([]);
      const [airingTv, setAiringTv] = useState([]);

      const [popularPageQuery, setPopularPageQuery] = useState(1);
      const [popularTvLoading, setPopularTvLoading] = useState(true);

      const [airingPageQuery, setAiringPageQuery] = useState(1);
      const [airingTvLoading, setAiringTvLoading] = useState(true);

      const [topRatedPageQuery, setTopRatedPageQuery] = useState(1);
      const [topRatedTvLoading, setTopRatedTvLoading] = useState(true);


      const getPopularTv = async () => {
            setPopularTvLoading(true);
            fetch(`/api/tvshows/popular?page=${popularPageQuery}`)
                  .then((res) => res.json())
                  .then((data) => setPopularTv(data))
                  .then(() => setPopularTvLoading(false));
      };


      const getTopRatedTv = async () => {
            setTopRatedTvLoading(true);
            fetch(`/api/tvshows/toprated?page=${topRatedPageQuery}`)
                  .then((res) => res.json())
                  .then((data) => setTopRatedTv(data))
                  .then(() => setTopRatedTvLoading(false));
      };
            
      

      const getAiringTv = async () => {
            setAiringTvLoading(true);
            fetch(`/api/tvshows/airing?page=${airingPageQuery}`)
                  .then((res) => res.json())
                  .then((data) => setAiringTv(data))
                  .then(() => setAiringTvLoading(false));
      };


      const getPopularTvPageOnClick = (page) => {
            (page < 1) ? setPopularPageQuery(1) : setPopularPageQuery(page);
      }

      const getAiringTvPageOnClick = (page) => {
            (page < 1) ? setAiringPageQuery(1) : setAiringPageQuery(page);
      }

      const getTopRatedTvPageOnClick = (page) => {
            (page < 1) ? setTopRatedPageQuery(1) : setTopRatedPageQuery(page);
      }

      useEffect(() => {
            getPopularTv();
      }, [popularPageQuery]);

      useEffect(() => {
            getTopRatedTv();
      }, [topRatedPageQuery]);

      useEffect(() => {
            getAiringTv();
      }, [airingPageQuery]);


      const getTvPlayerOnClick = (tvId) => {
            window.location.href = `/tvshows/${tvId}`;
      }


  return (
    <div>
      <Link to="/">
        <h1 className="tv-section-header">TV Series</h1>
      </Link>

      <div>
        <ul>
          <li className="header popular">Popular TV Shows</li>
          <li className="header latest">Airing Right Now</li>
          <li className="header top">Top Rated Shows</li>
        </ul>
      </div>

      <div className="tv-container">
        <div className="pagination popular">
          <div
            className="load-more-left"
            onClick={() => getPopularTvPageOnClick(popularPageQuery - 1)}
          ></div>
          <div
            className="load-more"
            onClick={() => getPopularTvPageOnClick(popularPageQuery + 1)}
          ></div>
          <label>{popularTvLoading ? <Spinner/> : `${popularPageQuery}`}</label>
        </div>
        <ul className="list popular-tv">
          {popularTv.map((show) => (
            <img
              className="item"
              alt=""
              key={show.id}
              src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
              onClick={() => getTvPlayerOnClick(show.id)}
            ></img>
          ))}
        </ul>
        <div className="pagination top">
          <div
            className="load-more-left"
            onClick={() => getTopRatedTvPageOnClick(topRatedPageQuery - 1)}
          ></div>
          <div
            className="load-more"
            onClick={() => getTopRatedTvPageOnClick(topRatedPageQuery + 1)}
          ></div>
          <label>{topRatedTvLoading ? <Spinner/>: `${topRatedPageQuery}`}</label>
        </div>
        <ul className="list toprated">
          {topRatedTv.map((show) => (
            <img
              className="item"
              alt=""
              key={show.id}
              src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
              onClick={() => getTvPlayerOnClick(show.id)}
            ></img>
          ))}
        </ul>
        <div className="pagination latest">
          <div
            className="load-more-left"
            onClick={() => getAiringTvPageOnClick(airingPageQuery - 1)}
          ></div>
          <div
            className="load-more"
            onClick={() => getAiringTvPageOnClick(airingPageQuery + 1)}
          ></div>
          <label>{airingTvLoading ? <Spinner/> : `${airingPageQuery}`}</label>
        </div>
        <ul className="list airing">
          {airingTv.map((show) => (
            <img
              className="item"
              alt=""
              key={show.id}
              src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
              onClick={() => getTvPlayerOnClick(show.id)}
            ></img>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Tvshows
