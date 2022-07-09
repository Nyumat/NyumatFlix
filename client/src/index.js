import React, {Suspense} from "react"
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './components/App'
import "./styles/index.css"
import Landing from './routes/landing/Landing'
import Movies from './routes/movies/Movies'
import Tvshows from './routes/tvshows/Tvshows'
import Player from './components/Player'
import ScrollToTop from './ScrollToTop'
import Navbar from "./components/Navbar"
import Search from './routes/search/Search'
import Logo from './components/Logo'
import Spinner from "./components/Spinner"

function NyumatFlix() {
  return (
    <Suspense fallback={Spinner}>
    <BrowserRouter>
      <ScrollToTop>
      <App />
      <Routes>
        <Route path="/" element={<><Landing/><Navbar/><Logo/></>}/>
        <Route path="/search" element={<><Search/><Navbar/><Logo/></>}/>
        <Route path="/movies"  element={<><Movies/><Logo/> <Navbar/></>}/>
        <Route path="/tvshows" element={<><Tvshows/><Logo/> <Navbar/></>}/>
        <Route path="/movies/:id" element={<><Player/><Navbar/></>}/>
        <Route path="/tvshows/:id" element={<><Player/><Navbar/></>}/>
      </Routes>
      </ScrollToTop>
    </BrowserRouter>
    </Suspense>

  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <div>
    <NyumatFlix />
  </div>
);
