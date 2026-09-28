import { expect, test } from "bun:test";
import { createApp } from "./api";
import { deskPort } from "./lib/config";

test("operation endpoint rejects inherited object properties", async () => {
  const app = createApp();
  const base = `http://127.0.0.1:${deskPort}`;
  const session = await app.request(`${base}/api/session`);
  const { token } = (await session.json()) as { token: string };
  const response = await app.request(`${base}/api/ops/toString`, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      "X-Deploy-Desk-Token": token,
    },
    body: JSON.stringify({ confirmed: true }),
  });

  expect(response.status).toBe(404);
});
