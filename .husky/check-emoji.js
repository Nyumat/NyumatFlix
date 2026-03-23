import fs from "fs";
import emojiRegex from "emojibase-regex";

const msgFile = process.argv[2];

if (!msgFile) {
  console.error("No commit message file found");
  process.exit(1);
}

const msg = fs.readFileSync(msgFile, "utf8");
const firstLine = msg.split(/\r?\n/)[0] ?? "";

const hasEmojiInSubject = new RegExp(emojiRegex.source, "gu").test(firstLine);
if (hasEmojiInSubject) process.exit(0);
process.exit(1);
