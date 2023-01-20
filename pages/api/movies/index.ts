import { Movie } from "./../../../typings";
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import axios
      from 'axios'
type Data = {
      movies: Movie[]
}

export default async function handler(
      req: NextApiRequest,
      res: NextApiResponse<Data>
) {
      let page = req.query.page;
      await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${process.env.API_KEY}&language=en-US&page=${page}`)
            .then(response => {
                  res.status(200).json({ movies: response.data })
            })
            .catch(error => {
                  res.status(400).json({ movies: [] })
            }
            )



}
