import React from 'react'
import "../styles/loading.css";

function Spinner() {
  return (
    <div id="loader-inner" className="loader-inner">
      <div className="loader-line-wrap">
            <div className="loader-line"></div>
      </div>
      <div className="loader-line-wrap">
            <div className="loader-line"></div>
      </div>
      <div className="loader-line-wrap">
            <div className="loader-line"></div>
      </div>
      <div className="loader-line-wrap">
            <div className="loader-line"></div>
      </div>
      <div className="loader-line-wrap">
            <div className="loader-line"></div>
      </div>
    </div>
  )
}

export default Spinner