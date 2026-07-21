import { describe, expect, it } from "vitest";

import { isSameSubnet, simulateDiagnostic, validateInterfaceConfig } from "../src/shared/network";
import type { ActiveFault } from "../src/shared/types";

describe("network learning model", () => {
  it("distinguishes local and remote IPv4 networks", () => {
    expect(isSameSubnet("192.168.10.23", "192.168.10.1", 24)).toBe(true);
    expect(isSameSubnet("192.168.10.23", "203.0.113.80", 24)).toBe(false);
    expect(isSameSubnet("10.1.15.8", "10.1.31.9", 19)).toBe(true);
  });

  it("rejects an off-subnet default gateway", () => {
    const errors = validateInterfaceConfig({
      address: "192.168.10.23",
      prefix: 24,
      gateway: "192.168.20.1",
      dns: "198.51.100.53",
    });
    expect(errors).toContain("PCとデフォルトゲートウェイが同じサブネットにありません。");
  });

  it("separates DNS failure from IP reachability", () => {
    const faults: ActiveFault[] = [
      {
        type: "DNS_DOWN",
        target: "dns",
        symptom: "IP直指定なら開きますがURLでは開きません。",
        injectedAt: "2026-07-22T00:00:00.000Z",
      },
    ];
    const lookup = simulateDiagnostic(
      "NSLOOKUP",
      "class.yamanashi.example",
      faults,
      "p_1",
      "2026-07-22T00:00:00.000Z",
      "diag_1",
    );
    const ping = simulateDiagnostic(
      "PING",
      "203.0.113.80",
      faults,
      "p_1",
      "2026-07-22T00:00:00.000Z",
      "diag_2",
    );
    expect(lookup.success).toBe(false);
    expect(ping.success).toBe(true);
  });
});
