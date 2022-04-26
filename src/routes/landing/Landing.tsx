import './Landing.css'
import {Link } from 'react-router-dom'
import Logo from '../../components/Logo'

function Landing () {
  return (
    <div className="landing">
      {<Logo></Logo>}
      <div className="landing-content">
        <h1>Welcome to My Movie Site</h1>
        <p>
          This is a simple web app which will be used to stream free movies!
        </p>
        <p>
          [Work in Prog.] You will be able to search for movies in the search box.
        </p>
        <p>
            [WIP] A TV Show section will be coming soon. Along with ... animations!
        </p>
        <p>
          Enjoy :)
        </p>
          <ul id="option-landing">
            <Link to="/movies">
                  <button className='landing-movie-section-btn'>MOVIES</button>
            </Link>
            <Link to="/tvshows">
                  <button className='landing-tv-section-btn'>SHOWS</button>
            </Link>

            <Link to="/search">
                  <button className='landing-search-btn'>SEARCH</button> 
            </Link>
          </ul>
      </div>

    </div>
    
  )

}

export default Landing