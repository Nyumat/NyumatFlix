import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import Movies from './routes/Movies'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Movies/>
    </BrowserRouter>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
