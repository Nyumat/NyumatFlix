import "../styles/Logo.css";
import "../styles/Player.css";
import { useEffect, useState } from "react";
import Select from 'react-select';

function Player() {
      const movieId = window.location.pathname.split("/")[2];
      const [movieData, setMovieData] = useState([]);

      const tvId = window.location.pathname.split("/")[2];
      const [tvData, setTvData] = useState([]);

      const [seasons, setSeasons] = useState([]);
      const [selectedSeason, setSelectedSeason] = useState([]);
      const [selectedEpisode, setSelectedEpisode] = useState([]);

      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => { getTvData(); getMovieData(); getSeasons(); }, [])

      const getSelectedSeasonEpisodes = (season) => {
            setSelectedSeason(season.value);
      }

      const getSelectedEpisode = (episode) => {
            setSelectedEpisode(episode.value);
      }


      const getTvData = async () => {
            fetch(`/api/tvshow?tvId=${tvId}`)
                  .then(res => res.json())
                  .then(data => setTvData(data))
                  .catch(err => console.log(err))
      }

      const getMovieData = async () => {
            fetch(`/api/movie?movieId=${movieId}`)
                  .then(res => res.json())
                  .then(data => setMovieData(data))
      }

      const getSeasons = async () => {
            fetch(`/api/seasons?tvId=${tvId}`)
                  .then(res => res.json())
                  .then(data => setSeasons(data.seasons))
      }

      if (window.location.pathname.split("/")[1] === "movies") {

            // eslint-disable-next-line react-hooks/rules-of-hooks
            useEffect(() => {
                  document.title = `${movieData.title} - NyumatFlix`;
            }, [movieData]);

            return (

                  <div>
                        <br>
                        </br>
                        <br>
                        </br>
                        <div className='movie-title'>
                              <h1>{movieData.title}</h1>
                        </div>
                        <br>
                        </br>
                        <div className='movie-release'>
                              <h2>Released: {new Date(movieData.release_date).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric"
                              })}</h2>
                        </div>
                        <br>
                        </br>
                        <br>
                        </br>
                        <div className="Player">
                              <div className="Player-container">
                                    <iframe id="iframe" title="Movie-player" allowFullScreen src={`https://www.${process.env.REACT_APP_BACKEND}/embed/tmdb/movie?id=${movieId}`}></iframe>
                              </div>
                        </div>
                  </div>

            );

      } else {
            let season_list = [];
            // eslint-disable-next-line array-callback-return
            seasons.map((season) => {
                  if (season.season_number !== 0) {
                        season_list.push({ value: season.season_number, label: `Season ${season.season_number}` });
                  }
            }, false);


            let episode_list = [];
            // eslint-disable-next-line array-callback-return
            seasons.map((season) => {
                  if (season.season_number === selectedSeason && season.season_number !== 0) {
                        for (let i = 1; i < season.episode_count + 1; i++) {
                              episode_list.push({ value: i, label: `Episode ${i}` });
                        }
                  }
            }, false);

            return (

                  // eslint-disable-next-line react-hooks/rules-of-hooks
                  useEffect(() => {
                        document.title = `${tvData.name} - NyumatFlix`;
                  }, [tvData]),


                  <div>
                        <br>
                        </br>
                        <br>
                        </br>
                        <div className='show-title'>
                              <h1>{tvData.name}</h1>
                        </div>
                        <br>
                        </br>
                        <div className='show-release'>
                              <h2>Released: {new Date(tvData.first_air_date).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric"
                              })}</h2>
                        </div>
                        <br>
                        </br>
                        <br>
                        </br>
                        <div className="Player">
                              <div className="Player-container">
                                    <iframe id="iframe" title="tv-player" allowFullScreen src={`https://www.${process.env.REACT_APP_BACKEND}/embed/tmdb/tv?id=${tvId}&s=${selectedSeason}&e=${selectedEpisode}`}></iframe>
                              </div>
                        </div>

                        <div className='selector-container'>

                              <ul className='selector-list'>
                                    <Select className='select-season'
                                          isRequired={true}
                                          placeholder="Select a Season"
                                          isSearchable={false}
                                          isOptionSelected={(option) => option.value === selectedSeason}
                                          defaultValue={"Season " + selectedSeason}
                                          options={season_list}
                                          onChange={getSelectedSeasonEpisodes}
                                    />
                                    <Select className='select-episode'
                                          placeholder="Select an Episode"
                                          defaultValue={"Episode " + selectedEpisode}
                                          isSearchable={false}
                                          noOptionsMessage={() => "Select a Season First"}
                                          isOptionSelected={(option) => option.value === selectedEpisode}
                                          options={episode_list}
                                          onChange={getSelectedEpisode}
                                    />
                              </ul>
                        </div>
                  </div>
            );
      }
}

export default Player;

