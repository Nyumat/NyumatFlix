const PORT = 8080;

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.listen(8080, () => {
      console.log(`Server is running on port ${PORT}`)
});