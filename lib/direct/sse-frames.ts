export type SseFrame = { event: string; data: string };

export function consumeSseFrames(
  chunk: string,
  carry: { buffer: string },
): SseFrame[] {
  carry.buffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const frames: SseFrame[] = [];
  while (true) {
    const idx = carry.buffer.indexOf("\n\n");
    if (idx < 0) {
      break;
    }
    const raw = carry.buffer.slice(0, idx);
    carry.buffer = carry.buffer.slice(idx + 2);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      }
    }
    if (dataLines.length > 0) {
      frames.push({ event, data: dataLines.join("\n") });
    }
  }
  return frames;
}
