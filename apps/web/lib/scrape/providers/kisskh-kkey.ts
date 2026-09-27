import { KISSKH_STATIC_DATA } from "./kisskh-staticdata";

type KisskhKeyKind = "sub" | "vid";

const stringToWordArray = (input: string): [number[], number] => {
  const wordArray: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    wordArray[index >>> 2] =
      (wordArray[index >>> 2] ?? 0) |
      ((input.charCodeAt(index) & 255) << (24 - (index % 4) * 8));
  }
  return [wordArray, input.length];
};

const wordArrayToHex = (array: Uint32Array, length: number): string =>
  Array.from({ length }, (_, index) =>
    ((array[index >>> 2]! >>> (24 - (index % 4) * 8)) & 255)
      .toString(16)
      .padStart(2, "0"),
  ).join("");

const transform = (value = ""): string => value.slice(0, 48);

const calculateHash = (input: string): number =>
  Array.from(input).reduce(
    (hash, char) => (hash << 5) - hash + char.charCodeAt(0),
    0,
  );

const padString = (input: string): string => {
  const paddingLength = 16 - (input.length % 16);
  return input + String.fromCharCode(paddingLength).repeat(paddingLength);
};

const encryptBlock = (words: number[], offset: number): void => {
  const [roundKeys, table0, table1, table2, table3, sbox] = KISSKH_STATIC_DATA;
  const previous =
    offset === 0
      ? [22039283, 1457920463, 776125350, -1941999367]
      : words.slice(offset - 4, offset);

  for (let index = 0; index < 4; index += 1) {
    words[offset + index] =
      (words[offset + index] ?? 0) ^ (previous[index] ?? 0);
  }

  let state0 = (words[offset] ?? 0) ^ (roundKeys[0] ?? 0);
  let state1 = (words[offset + 1] ?? 0) ^ (roundKeys[1] ?? 0);
  let state2 = (words[offset + 2] ?? 0) ^ (roundKeys[2] ?? 0);
  let state3 = (words[offset + 3] ?? 0) ^ (roundKeys[3] ?? 0);
  let roundIndex = 4;

  for (let round = 1; round < 10; round += 1) {
    const next0 =
      (table0[state0 >>> 24] ?? 0) ^
      (table1[(state1 >>> 16) & 255] ?? 0) ^
      (table2[(state2 >>> 8) & 255] ?? 0) ^
      (table3[state3 & 255] ?? 0) ^
      (roundKeys[roundIndex++] ?? 0);
    const next1 =
      (table0[state1 >>> 24] ?? 0) ^
      (table1[(state2 >>> 16) & 255] ?? 0) ^
      (table2[(state3 >>> 8) & 255] ?? 0) ^
      (table3[state0 & 255] ?? 0) ^
      (roundKeys[roundIndex++] ?? 0);
    const next2 =
      (table0[state2 >>> 24] ?? 0) ^
      (table1[(state3 >>> 16) & 255] ?? 0) ^
      (table2[(state0 >>> 8) & 255] ?? 0) ^
      (table3[state1 & 255] ?? 0) ^
      (roundKeys[roundIndex++] ?? 0);
    state3 =
      (table0[state3 >>> 24] ?? 0) ^
      (table1[(state0 >>> 16) & 255] ?? 0) ^
      (table2[(state1 >>> 8) & 255] ?? 0) ^
      (table3[state2 & 255] ?? 0) ^
      (roundKeys[roundIndex++] ?? 0);
    state0 = next0;
    state1 = next1;
    state2 = next2;
  }

  const mixed0 =
    (((sbox[state0 >>> 24] ?? 0) << 24) |
      ((sbox[(state1 >>> 16) & 255] ?? 0) << 16) |
      ((sbox[(state2 >>> 8) & 255] ?? 0) << 8) |
      (sbox[state3 & 255] ?? 0)) ^
    (roundKeys[roundIndex++] ?? 0);
  const mixed1 =
    (((sbox[state1 >>> 24] ?? 0) << 24) |
      ((sbox[(state2 >>> 16) & 255] ?? 0) << 16) |
      ((sbox[(state3 >>> 8) & 255] ?? 0) << 8) |
      (sbox[state0 & 255] ?? 0)) ^
    (roundKeys[roundIndex++] ?? 0);
  const mixed2 =
    (((sbox[state2 >>> 24] ?? 0) << 24) |
      ((sbox[(state3 >>> 16) & 255] ?? 0) << 16) |
      ((sbox[(state0 >>> 8) & 255] ?? 0) << 8) |
      (sbox[state1 & 255] ?? 0)) ^
    (roundKeys[roundIndex++] ?? 0);
  const mixed3 =
    (((sbox[state3 >>> 24] ?? 0) << 24) |
      ((sbox[(state0 >>> 16) & 255] ?? 0) << 16) |
      ((sbox[(state1 >>> 8) & 255] ?? 0) << 8) |
      (sbox[state2 & 255] ?? 0)) ^
    (roundKeys[roundIndex++] ?? 0);

  words[offset] = mixed0;
  words[offset + 1] = mixed1;
  words[offset + 2] = mixed2;
  words[offset + 3] = mixed3;
};

const processBlock = (words: number[]): void => {
  for (let offset = 0; offset < words.length; offset += 4) {
    encryptBlock(words, offset);
  }
};

export const getKisskhKey = ({
  id,
  subOrVid,
  hash = "mg3c3b04ba",
  version = "2.8.10",
  viGuid = "62f176f3bb1b5b8e70e39932ad34a0c7",
  subGuid = "VgV52sWhwvBSf8BsM3BRY9weWiiCbtGp",
  platformVer = "4830201",
}: {
  id: string | number;
  subOrVid: KisskhKeyKind;
  hash?: string;
  version?: string;
  viGuid?: string;
  subGuid?: string;
  platformVer?: string;
}): string => {
  const data = [
    "",
    id,
    null,
    hash,
    version,
    subOrVid === "sub" ? subGuid : viGuid,
    platformVer,
    transform("kisskh"),
    transform("kisskh".toLowerCase()),
    transform("kisskh"),
    "kisskh",
    "kisskh",
    "kisskh",
    "00",
    "",
  ];
  data.splice(1, 0, calculateHash(data.join("|")));
  const padded = padString(data.join("|"));
  const [words, byteLength] = stringToWordArray(padded);
  processBlock(words);
  return wordArrayToHex(
    Uint32Array.from(words.map((word) => word ?? 0)),
    byteLength,
  ).toUpperCase();
};
