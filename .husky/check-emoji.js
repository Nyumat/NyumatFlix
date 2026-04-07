import fs from "fs";
import emojiRegex from "emojibase-regex";

const msgFile = process.argv[2];

if (!msgFile) {
  console.error("No commit message file found");
  process.exit(1);
}

const msg = fs.readFileSync(msgFile, "utf8");
const firstLine = (msg.split(/\r?\n/)[0] ?? "").trim();

// emojibase-regex covers most sequences; avoid the `g` flag so .test() does not
// depend on lastIndex. Extended_Pictographic catches edge cases the base pattern misses.
const emojibasePattern = new RegExp(emojiRegex.source, "u");
const hasEmojiInSubject =
  emojibasePattern.test(firstLine) ||
  /\p{Extended_Pictographic}/u.test(firstLine);

if (hasEmojiInSubject) process.exit(0);
process.exit(1);
