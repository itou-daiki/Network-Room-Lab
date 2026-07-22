import { describe, expect, it } from "vitest";

import { isSameSubnet, simulateDiagnostic, validateInterfaceConfig } from "../src/shared/network";
import { DEFAULT_LINKS } from "../src/shared/scenario";
import type { ActiveFault, LearningTarget } from "../src/shared/types";

const learningTarget: LearningTarget = {
  url: "https://example.com/lesson",
  hostname: "example.com",
  requestTarget: "/lesson",
  ipv4Addresses: ["93.184.216.34"],
  primaryIpv4: "93.184.216.34",
  dnsTtl: 240,
  resolvedAt: "2026-07-23T00:00:00.000Z",
  resolver: "Cloudflare 1.1.1.1（DNS over HTTPS）",
};

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
      dns: "1.1.1.1",
    });
    expect(errors.some((error) => error.includes("PC（192.168.10.23/24）と出口（192.168.20.1）が同じネットワークにありません"))).toBe(true);
  });

  it("separates DNS failure from IP reachability", () => {
    const faults: ActiveFault[] = [
      {
        type: "DNS_DOWN",
        target: "dns",
        symptom: "WebサーバのIPアドレスを指定すると届きますが、Webサイト名では届きません。",
        injectedAt: "2026-07-22T00:00:00.000Z",
      },
    ];
    const lookup = simulateDiagnostic(
      "NSLOOKUP",
      "www.mext.go.jp",
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

  it("reflects a learner-disconnected link in command output", () => {
    const links = DEFAULT_LINKS.map((link) => ({ ...link, up: link.id !== "ap-switch" }));
    const result = simulateDiagnostic(
      "PING",
      "192.168.10.1",
      [],
      "p_1",
      "2026-07-22T00:00:00.000Z",
      "diag_link",
      {
        links,
        interfaceConfig: { address: "192.168.10.23", prefix: 24, gateway: "192.168.10.1", dns: "1.1.1.1" },
      },
    );
    expect(result.success).toBe(false);
    expect(result.output.join(" ")).toContain("ap-switch");
  });

  it("shows the room creation DNS result only for the selected hostname", () => {
    const saved = simulateDiagnostic("NSLOOKUP", "example.com", [], "p_1", "2026-07-23T00:00:00.000Z", "diag_dns", { learningTarget });
    expect(saved.success).toBe(true);
    expect(saved.output.join(" ")).toContain("93.184.216.34");
    expect(saved.output.join(" ")).toContain("Cloudflare 1.1.1.1");
    expect(saved.inference).toContain("実際に問い合わせ");

    const other = simulateDiagnostic("NSLOOKUP", "www.mext.go.jp", [], "p_1", "2026-07-23T00:00:00.000Z", "diag_other", { learningTarget });
    expect(other.success).toBe(false);
    expect(other.output.join(" ")).not.toContain("93.184.216.34");
  });

  it("lets ping reach a stopped web server while HTTPS still fails", () => {
    const faults: ActiveFault[] = [{ type: "WEB_DOWN", target: "web", symptom: "Web停止", injectedAt: "2026-07-22T00:00:00.000Z" }];
    const ping = simulateDiagnostic("PING", "203.0.113.80", faults, "p_1", "2026-07-22T00:00:00.000Z", "diag_ping");
    const https = simulateDiagnostic("HTTPS", "www.mext.go.jp", faults, "p_1", "2026-07-22T00:00:00.000Z", "diag_https");
    expect(ping.success).toBe(true);
    expect(https.success).toBe(false);
    expect(https.output.join(" ")).toContain("connection refused");
  });
});
