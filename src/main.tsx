import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './components/App'
import "./styles/index.css"
import Landing from './routes/landing/Landing'
import Movies from './routes/movies/Movies'


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    
    <BrowserRouter>
      <App />
      <Routes>
        <Route path="/" element={<><Landing/></>}/>
        <Route path="/movies"  element={<><Movies/></>}/>

      </Routes>

    </BrowserRouter>

      
    
  </React.StrictMode>
)

