import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './components/App'
import "./styles/index.css"
import Landing from './routes/landing/Landing'
import Movies from './routes/movies/Movies'
import Tvshows from './routes/tvshows/Tvshows'
import Player from './components/Player'
import { useEffect, useState } from 'react'
import ScrollToTop from './ScrollToTop'
import Search from './routes/search/Search'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ScrollToTop>
      <App />
      <Routes>
        <Route path="/" element={<><Landing/></>}/>
        <Route path="/search" element={<><Search/></>}/>
        <Route path="/movies"  element={<><Movies/></>}/>
        <Route path="/tvshows" element={<><Tvshows/></>}/>
        <Route path="/movies/:id" element={<><Player/></>}/>
        <Route path="/tvshows/:id" element={<><Player/></>}/>
      </Routes>
      </ScrollToTop>
    </BrowserRouter>

      
    
  </React.StrictMode>
)

