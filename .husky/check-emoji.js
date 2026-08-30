import fs from "fs";

const msgFile = process.argv[2];

if (!msgFile) {
  console.error("No commit message file found");
  process.exit(2);
}

const msg = fs.readFileSync(msgFile, "utf8");
const firstLine = (msg.split(/\r?\n/)[0] ?? "").trim();

const hasEmojiInSubject =
  /\p{Extended_Pictographic}/u.test(firstLine) ||
  /\p{Emoji_Presentation}/u.test(firstLine);

if (hasEmojiInSubject) {
  process.exit(0);
}

process.exit(1);
