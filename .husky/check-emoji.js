import fs from "fs";
import emojiRegex from "emojibase-regex";

const msgFile = process.argv[2];

if (!msgFile) {
  console.error("No commit message file found");
  process.exit(1);
}

const msg = fs.readFileSync(msgFile, "utf8");

const re = new RegExp("^\\s*(" + emojiRegex.source + ")");
if (!re.test(msg)) process.exit(1);
