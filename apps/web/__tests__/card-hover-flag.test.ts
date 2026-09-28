import { describe, expect, it } from "vitest";

import { DEFAULT_FLAG_VALUES } from "@/lib/flags/flag-catalog";
import { resolveSiteFlags } from "@/lib/flags/site-flags";

describe("card hover kill switch", () => {
  it("disables hover previews when global.card_hover_previews is off", () => {
    const flags = resolveSiteFlags({
      ...DEFAULT_FLAG_VALUES,
      "global.card_hover_previews": false,
    });

    expect(flags.cardHoverPreviews).toBe(false);
  });
});
