import { useState } from 'react'
import logo from './logo.svg'
import './App.css'
import { Outlet, Routes, Route, BrowserRouter, Link } from 'react-router-dom'
import Movies from './routes/Movies'


function App() {

  return (
    <div className="App">
      <section className="App-header">

        <img src={logo} className="App-logo" alt="logo" />

      </section>
    </div>
  
  )
}

export default App
