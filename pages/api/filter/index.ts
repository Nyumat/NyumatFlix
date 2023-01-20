import { Movie, TvShow } from "../../../typings";
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import axios
      from 'axios'

type Data = {
      filter_data: TvShow[] | Movie[],
}


export default async function handler(
      req: NextApiRequest,
      res: NextApiResponse<Data>,
) {

      if (!req.query.filter || !req.query.page) return res.status(400).json({ filter_data: [] })
      let { filter, page } = req.query;
      await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${process.env.API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=${filter}`)
            .then(response => {
                  return res.status(200).json({ filter_data: response.data.results })
            }).catch(error => {
                  return res.status(400).json({ filter_data: [] })
            }
            )
}
