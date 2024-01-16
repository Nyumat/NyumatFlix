import { Movie, TvShow } from "../../../utils/typings";
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import axios from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  filter_data: TvShow[] | Movie[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (!req.query.filter || !req.query.page)
    return res.status(400).json({ filter_data: [] });
  const { filter, page } = req.query;
  await axios
    .get(
      `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}&with_genres=${filter}`,
    )
    .then((response) => {
      return res.status(200).json({ filter_data: response.data.results });
    })
    .catch(() => {
      return res.status(400).json({ filter_data: [] });
    });
}
