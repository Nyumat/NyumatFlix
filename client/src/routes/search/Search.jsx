import "./Search.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";




function Search () {
      // ------ STATE ------
      const [searchData, setSearchData] = useState([]);
      const [searchTerm, setSearchTerm] = useState("");
      const [searchLoading, setSearchLoading] = useState(false);
      const [searchError, setSearchError] = useState(false);
      const [searchPage, setSearchPage] = useState(1);
      const [searchTotalPages, setSearchTotalPages] = useState(1);
      const [searchTotalResults, setSearchTotalResults] = useState(0);
      
      const getSearchResults = async () => {
            setSearchLoading(true);
            setSearchError(false);
            try {
                  fetch(`/api/search?searchTerm=${searchTerm}&searchPage=${searchPage}`)
                  .then(res => res.json())
                  .then(data => {
                  setSearchTotalResults(data.total_results);
                  setSearchData(data.results);
                  setSearchTotalPages(data.total_pages);
                  setSearchLoading(false);
                  })
            } catch (err) {
                  setSearchError(true);
                  setSearchLoading(false);
            }


      }

      useEffect(() => {
            if (searchTerm !== "") {
                  getSearchResults();
            }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [searchTerm, searchPage, searchTotalResults]);

      const getSearchPageOnClick = (page) => {
            setSearchPage(page);
      }



      const showResults = () => {
            const results = searchData.map((result, index) => {
                  let mediaType = "";
                  if (result.media_type === "movie") {
                        mediaType = "movies";
                  } else if (result.media_type === "tv") {
                        mediaType = "tvshows";
                  } else {
                        mediaType = "people";
                  }

                  if (result.release_date === null || result.poster_path === null ||  result.backdrop_path === null || result.first_air_date === null || mediaType === "people") {
                        return null;
                  } else {
                      return (
                              <div className="search-result" key={index}>
                                    <Link to={`/${mediaType}/${result.id}`}>
                                          <img id="poster" src={`https://image.tmdb.org/t/p/w500${result.poster_path}`} alt={result.title} />
                                          <div className="search-result-info">
                                    <p className="lol">{result.title || result.name}</p>
                                <p className="lol">
                                    {new Date(result.release_date || result.first_air_date).toLocaleDateString(
                                    "en-US",
                                    {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    }
                                  )}
                                </p>
                              </div>
                                    </Link>
                              </div>
                        );
                  }


            });

            return results;
      }


      return (

            <div className="search-container">
                  <div className="search-title">
                        Search
                  </div>

                  <input type="text" placeholder="Search by title. . ." onChange={e => setSearchTerm(e.target.value)} value={searchTerm} />
                  <h3>Search Results {searchTotalResults}</h3>
                  <h3>Page {`${searchPage} of ${searchTotalPages}`}</h3>
                  <div className="search-results">
                        {searchLoading && <div id="search-status">Loading...</div>}
                        {searchError && <div id="search-status">Error...</div>}
                        {showResults()}
                  </div>
                  <div className="search-btns">
                        {searchPage > 1 && <button className="page-btn" onClick={() => getSearchPageOnClick(searchPage - 1)}>Previous</button>}
                        <div id="divider"></div>
                        {searchPage < searchTotalPages && <button className="page-btn" onClick={() => getSearchPageOnClick(searchPage + 1)}>Next</button>}
                  </div>
                  <footer className='search-footer'>
                        <p>Rights reserved to Tom N. and NyumatFlix</p>
                  </footer>
            </div>


      );
      




}

export default Search;