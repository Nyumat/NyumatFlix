import logo from '../img/logo.svg';
import "../styles/App.css";
import { Link } from 'react-router-dom'
import Logo from './Logo';


function App() {

  return (
    <div className="App">
      <section className="App-header">
        <Link to ="/">
              <img src={logo} className="App-logo" alt="logo" />
        </Link>
      </section>
    </div>
  )
}

export default App
