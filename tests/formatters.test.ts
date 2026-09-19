import { describe, expect, it } from "vitest";
import { cleanTokenSymbol } from "../src/utils/formatters";

describe("cleanTokenSymbol", () => {
  it("strips emoji and keeps the ticker", () => {
    expect(cleanTokenSymbol("🌱BLESS")).toBe("BLESS");
    expect(cleanTokenSymbol("ASKR🌱")).toBe("ASKR");
    expect(cleanTokenSymbol("🚀PEPE💎")).toBe("PEPE");
    expect(cleanTokenSymbol("BLESS")).toBe("BLESS");
  });
});
