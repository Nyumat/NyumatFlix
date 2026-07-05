import { createDecipheriv, createHash } from "node:crypto";

const ALLANIME_SECRET = "Xot36i3lK3:v1";
const ALLANIME_KEY = createHash("sha256").update(ALLANIME_SECRET).digest();

const decrypt = (blobBase64: string) => {
  const blob = Buffer.from(blobBase64, "base64");
  const iv = blob.subarray(1, 13);
  const ciphertext = blob.subarray(13, blob.length - 16);
  const ctrIv = Buffer.concat([iv, Buffer.from([0, 0, 0, 2])]);
  const decipher = createDecipheriv("aes-256-ctr", ALLANIME_KEY, ctrIv);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

const VARS = encodeURIComponent(
  JSON.stringify({
    showId: "ReooPAxPMsHM4KPMY",
    translationType: "sub",
    episodeString: "1",
  }),
);
const EXT = encodeURIComponent(
  JSON.stringify({
    persistedQuery: {
      version: 1,
      sha256Hash:
        "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec",
    },
  }),
);

const res = await fetch(
  `https://api.allanime.day/api?variables=${VARS}&extensions=${EXT}`,
  { headers: { Referer: "https://allmanga.to" } },
);
const json = (await res.json()) as { data?: { tobeparsed?: string } };
const tp = json.data?.tobeparsed;
console.log("tobeparsed len", tp?.length);
if (tp) {
  const plain = decrypt(tp);
  console.log(plain.slice(0, 1200));
}
