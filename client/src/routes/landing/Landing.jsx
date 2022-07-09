import './Landing.css'

function Landing () {
  return (
    <div className="landing">
      
      <div className="landing-content">
        <h1><span className='blue'>NyumatFlix</span></h1>
        <p className='github'>An app made by <a href='https://github.com/nyumat'>@Nyumat</a></p>
      </div>

      <div className='landing-intro'>
        <p className='space'></p>
        <h1>What is <span className='blue'>NyumatFlix?</span></h1>

        
        <p>NyumatFlix is a web app that allows you to search and stream movies and tv shows.</p>
        <p>I created NyumatFlix as an alternative to traditional streaming platforms.</p>
        <p>The full source code is hosted on a GitHub repository, <a href='https://github.com/nyumat/nyumatflix'>here</a>.</p>
        <p>For any feature requests or issues, open an issue or email me,  <a href='mailto:nyumat18@gmail.com?subject=Feature Request'>here</a>.</p>
        <p>Enjoy! (◕‿◕)</p>
        <br></br>
        <p>-Nyumat</p>
      </div>
      <div>
      </div>

      <footer className='landing-footer'>
        <p>Rights reserved to Tom N. and NyumatFlix</p>
      </footer>
    </div>
  )

}

export default Landing