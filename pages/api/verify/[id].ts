// Next.js API route support: https://nextjs.org/docs/api-routes/introductio
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

interface Data {
  status: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  const { id } = req.query;
  const url = process.env.NYUMATFLIX_VPS + "=" + id;
  axios
    .get(url)
    .then((response) => {
      if (response.data.includes("404")) {
        res.status(200).json({
          status: 0,
        });
      } else {
        res.status(200).json({
          status: 1,
        });
      }
    })
    .catch((error) => {
      res.status(200).json({
        status: 0,
      });
      console.trace(error);
    });
}
