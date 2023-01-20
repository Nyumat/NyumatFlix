import { Movie, TvShow } from "../../../typings";
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import axios
      from 'axios'

type Data = {
      search_data: TvShow[] | Movie[],
      query: string,
      page: number
}


export default async function handler(
      req: NextApiRequest,
      res: NextApiResponse<Data>,
) {
      if (!req.query.query || !req.query.page) return res.status(400).json({ search_data: [], query: '', page: 0 }
      )

      let { query, page } = req.query;
      await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${process.env.API_KEY}&language=en-US&query=${query}&page=${page}&include_adult=false`)
            .then(response => {
                  return res.status(200).json({ search_data: response.data.results, query: query as string, page: page as unknown as number })
            }).catch(error => {
                  return res.status(400).json({ search_data: [], query: '', page: 0 })
            }
            )


}
