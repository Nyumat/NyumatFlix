import React from 'react'
import "../styles/navbar.css";
import "../routes/tvshows/Tvshows.css"
import { Link } from 'react-router-dom';

function Navbar() {

  return (

      <div className='navbar-container'>
            <ul className='navbar-list'>
              <li className='navbar-item'>
                <Link to='/' className='navbar-link'>Home</Link>
              </li>
              <li className='navbar-item'>
                <Link to='/tvshows' className='navbar-link'>TV Shows</Link>
              </li>
              <li className='navbar-item'>
                <Link to='/movies' className='navbar-link'>Movies</Link>
              </li>
              <li className='navbar-item'>
                <Link to='/search' className='navbar-link'>Search</Link>
              </li>
            </ul>
      </div>

  )
}

export default Navbar