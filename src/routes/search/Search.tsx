import "./Search.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "material-ui-search-bar";


function Search () {
      // ------ STATE ------
      const [searchData, setSearchData] = useState<any>([]);
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
                  const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=[your_api_key]9&language=en-US&query=${searchTerm}&page=${searchPage}`);
                  const data = await response.json();
                  setSearchTotalResults(data.total_results);
                  setSearchData(data.results);
                  setSearchTotalPages(data.total_pages);
                  setSearchLoading(false);
            } catch (error) {
                  setSearchError(true);
                  setSearchLoading(false);
            }
      }

      useEffect(() => {
            if (searchTerm !== "") {
                  getSearchResults();
            }
      }, [searchTerm, searchPage, searchTotalResults]);

      const getSearchPageOnClick = (page: number) => {
            setSearchPage(page);
      }


      return (

            <div className="search-container">
                  <Link to="/">
                        <h2 id="search-header">Search Section</h2>
                  </Link>
                  <input type="text" placeholder="Search by title. . ." onChange={e => setSearchTerm(e.target.value)} value={searchTerm} />
                  <h3>Search Results {searchTotalResults}</h3>
                  <h3>Page {`${searchPage} of ${searchTotalPages}`}</h3>
                  <div className="search-results">
                        {searchLoading && <div id="search-status">Loading...</div>}
                        {searchError && <div id="search-status">Error...</div>}
                        {searchData.map((movie: any) => (
                              <div key={movie.id} className="search-result">
                                    <Link to={`/movies/${movie.id}`}>
                                          <img id="poster" src={movie.poster_path ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}` : movie.backdrop_path} alt={movie.backdrop_path} />
                                    </Link>
                                    <div className="search-result-info">
                                          <Link to={`/movies/${movie.id}`}>
                                                <h3 id="movie-title">{movie.title}</h3>
                                          </Link>
                                          <p id="movie-release">{movie.release_date}</p>
                                    </div>
                              </div>
                        ))}
                  </div>
                  <div className="search-btns">
                        {searchPage > 1 && <button className="page-btn" onClick={() => getSearchPageOnClick(searchPage - 1)}>Previous</button>}
                        <div id="divider"></div>
                        {searchPage < searchTotalPages && <button className="page-btn" onClick={() => getSearchPageOnClick(searchPage + 1)}>Next</button>}
                  </div>
            </div>


      );
      




}

export default Search;