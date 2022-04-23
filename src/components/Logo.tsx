import { Link } from 'react-router-dom'
import nyumatFlix from "../img/logo.png"
import "../styles/Logo.css";

function Logo() {

  return (
    <div className="Logo">
        <Link to ="/">
              <img src={nyumatFlix} className="nyumat-flix" alt="logo"/>
        </Link>
    </div>
  )
}

export default Logo
