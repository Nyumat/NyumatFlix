import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scrapeIndexSource = readFileSync(
  join(process.cwd(), "lib/scrape/index.ts"),
  "utf8",
);

const hexaWasmSessionSource = readFileSync(
  join(process.cwd(), "lib/scrape/hexa-wasm-session.ts"),
  "utf8",
);

const deployLibSource = readFileSync(
  join(process.cwd(), "../../scripts/deploy-lib.sh"),
  "utf8",
);

const deployScriptSource = readFileSync(
  join(process.cwd(), "../../scripts/deploy.sh"),
  "utf8",
);

describe("scrape route boot", () => {
  it("does not statically import the hexa provider from scrape/index", () => {
    expect(scrapeIndexSource).not.toMatch(/from\s+["']\.\/providers\/hexa["']/);
    expect(scrapeIndexSource).toMatch(/import\("\.\/providers\/hexa"\)/);
  });

  it("does not statically import playwright in hexa-wasm-session", () => {
    expect(hexaWasmSessionSource).toMatch(
      /import type \{ Browser, BrowserContext, Page \} from "playwright"/,
    );
    expect(hexaWasmSessionSource).not.toMatch(
      /^import \{ chromium \} from "playwright";/m,
    );
    expect(hexaWasmSessionSource).toMatch(/import\("playwright"\)/);
  });

  it("wires scrape route verification into deploy paths", () => {
    expect(deployLibSource).toMatch(/verify_scrape_api_route\(\) \{/);
    expect(deployScriptSource).toMatch(
      /verify_scrape_api_route "\$PREVIEW_CONTAINER"/,
    );
    expect(deployScriptSource).toMatch(/verify_scrape_api_route "\$candidate"/);
    expect(deployScriptSource).toMatch(
      /verify_scrape_api_route "" "" "http:\/\/127\.0\.0\.1:\$\{target_port\}"/,
    );
  });
});
