import { describe, expect, it } from "vitest";
import {
  assignOwners,
  assignRegionTopPercentile,
  isSplitRegion,
  regionKey,
  regionLabel,
  splitExplainer,
} from "./focus-regions.js";

/**
 * Who owns a client decides whose Focus report they appear on, so a wrong
 * answer here is a salesperson chasing someone else's book — or nobody chasing
 * a client at all.
 */

describe("regionKey", () => {
  it("reduces a Spiro service area to the city the BDS book names", () => {
    expect(regionKey("Cincinnati, Ohio")).toBe("cincinnati");
    expect(regionKey("Fort Wayne, Indiana")).toBe("fort wayne");
    expect(regionKey("  DAYTON , Ohio ")).toBe("dayton");
  });

  it("survives a missing service area", () => {
    expect(regionKey(null)).toBe("");
    expect(regionKey(undefined)).toBe("");
    expect(regionLabel(null)).toBe("Unknown");
  });
});

describe("assignOwners", () => {
  const client = (key: string, region: string | null, revenue: number) => ({
    key,
    region,
    revenue,
  });

  it("hands each sole-owner region to its BDS", () => {
    const owners = assignOwners([
      client("a", "Cincinnati, Ohio", 100),
      client("b", "Charlotte, North Carolina", 100),
      client("c", "Toledo, Ohio", 100),
      client("d", "Findlay, Ohio", 100),
      client("e", "Fort Wayne, Indiana", 100),
      client("f", "Lima, Ohio", 100),
    ]);
    expect(owners.get("a")).toBe("Pam Branam");
    expect(owners.get("b")).toBe("Joy Kiser");
    // Toledo and Findlay are one book.
    expect(owners.get("c")).toBe("Craig Magrum");
    expect(owners.get("d")).toBe("Craig Magrum");
    expect(owners.get("e")).toBe("Chris Voge");
    expect(owners.get("f")).toBe("Ryan Bowersock");
  });

  it("splits Columbus and Dayton at the top 20% by revenue", () => {
    // Ten shared clients: the top two are Chris's, the rest Ryan's.
    const clients = Array.from({ length: 10 }, (_, i) =>
      client(`c${i}`, i % 2 === 0 ? "Columbus, Ohio" : "Dayton, Ohio", (10 - i) * 100),
    );
    const owners = assignOwners(clients);
    expect(owners.get("c0")).toBe("Chris Voge");
    expect(owners.get("c1")).toBe("Chris Voge");
    expect(owners.get("c2")).toBe("Ryan Bowersock");
    expect(owners.get("c9")).toBe("Ryan Bowersock");
  });

  it("ranks Columbus and Dayton together, not city by city", () => {
    // The two biggest are both in Columbus; Dayton's best is still outranked.
    const owners = assignOwners([
      client("col-big", "Columbus, Ohio", 900),
      client("col-big2", "Columbus, Ohio", 800),
      client("day-mid", "Dayton, Ohio", 700),
      client("day-low", "Dayton, Ohio", 10),
      client("col-low", "Columbus, Ohio", 5),
    ]);
    expect(owners.get("col-big")).toBe("Chris Voge");
    expect(owners.get("day-mid")).toBe("Ryan Bowersock");
  });

  it("keeps at least one client in the top slice of a small shared book", () => {
    const owners = assignOwners([
      client("x", "Columbus, Ohio", 50),
      client("y", "Dayton, Ohio", 10),
    ]);
    // ceil(2 * 0.2) = 1, so the bigger client is Chris's.
    expect(owners.get("x")).toBe("Chris Voge");
    expect(owners.get("y")).toBe("Ryan Bowersock");
  });

  it("recomputes the split from the period's revenue, so a grower changes hands", () => {
    const quiet = assignOwners([
      client("riser", "Columbus, Ohio", 10),
      client("steady", "Columbus, Ohio", 500),
      client("other", "Dayton, Ohio", 400),
      client("more", "Dayton, Ohio", 300),
      client("last", "Columbus, Ohio", 200),
    ]);
    expect(quiet.get("riser")).toBe("Ryan Bowersock");

    const busy = assignOwners([
      client("riser", "Columbus, Ohio", 9000),
      client("steady", "Columbus, Ohio", 500),
      client("other", "Dayton, Ohio", 400),
      client("more", "Dayton, Ohio", 300),
      client("last", "Columbus, Ohio", 200),
    ]);
    expect(busy.get("riser")).toBe("Chris Voge");
  });

  it("breaks a revenue tie the same way every time", () => {
    const clients = [
      client("bbb", "Columbus, Ohio", 100),
      client("aaa", "Columbus, Ohio", 100),
      client("ccc", "Dayton, Ohio", 100),
      client("ddd", "Dayton, Ohio", 100),
      client("eee", "Columbus, Ohio", 100),
    ];
    const first = assignOwners(clients);
    const second = assignOwners(clients.toReversed());
    // A client must not swap owners between two identical page loads.
    for (const c of clients) {
      expect(second.get(c.key)).toBe(first.get(c.key));
    }
  });

  it("leaves a client in an unowned region unassigned rather than guessing", () => {
    const owners = assignOwners([
      client("stray", "Cleveland, Ohio", 500),
      client("nowhere", null, 500),
    ]);
    expect(owners.has("stray")).toBe(false);
    expect(owners.has("nowhere")).toBe(false);
  });

  it("knows which regions are shared", () => {
    expect(isSplitRegion("Columbus, Ohio")).toBe(true);
    expect(isSplitRegion("Dayton, Ohio")).toBe(true);
    expect(isSplitRegion("Cincinnati, Ohio")).toBe(false);
  });
});

describe("assignRegionTopPercentile", () => {
  const client = (key: string, region: string | null, revenue: number) => ({
    key,
    region,
    revenue,
  });

  it("cuts the top fifth of each region separately", () => {
    // Ten clients per region, so the top slice is two in each.
    const clients = [
      ...Array.from({ length: 10 }, (_, i) => client(`cin${i}`, "Cincinnati, Ohio", (i + 1) * 100)),
      ...Array.from({ length: 10 }, (_, i) => client(`tol${i}`, "Toledo, Ohio", (i + 1) * 10)),
    ];
    const top = assignRegionTopPercentile(clients);
    expect(top.size).toBe(4);
    expect([...top].toSorted()).toEqual(["cin8", "cin9", "tol8", "tol9"]);
  });

  it("ranks Columbus and Dayton apart, unlike the ownership split", () => {
    // Every Dayton client out-earns every Columbus one. Ranked together — the
    // way assignOwners does it — no Columbus client would make the top slice.
    const clients = [
      ...Array.from({ length: 5 }, (_, i) => client(`col${i}`, "Columbus, Ohio", (i + 1) * 10)),
      ...Array.from({ length: 5 }, (_, i) => client(`day${i}`, "Dayton, Ohio", 10000 + i)),
    ];
    const top = assignRegionTopPercentile(clients);
    expect(top.has("col4")).toBe(true);
    expect(top.has("day4")).toBe(true);

    // The contrast that makes this a separate function rather than a reuse.
    const owners = assignOwners(clients);
    expect(owners.get("col4")).toBe("Ryan Bowersock");
    expect(owners.get("day4")).toBe("Chris Voge");
  });

  it("always tags at least one client in a region that billed anything", () => {
    const top = assignRegionTopPercentile([
      client("solo", "Lima, Ohio", 250),
      client("other", "Lima, Ohio", 100),
    ]);
    expect([...top]).toEqual(["solo"]);
  });

  it("tags nobody in a region where everyone billed zero", () => {
    const top = assignRegionTopPercentile([
      client("a", "Findlay, Ohio", 0),
      client("b", "Findlay, Ohio", 0),
    ]);
    expect(top.size).toBe(0);
  });

  it("never tags a zero-revenue client, even in a tiny region", () => {
    // The slice would reach both, but a client billing nothing is not "top".
    const top = assignRegionTopPercentile([
      client("earner", "Charlotte, North Carolina", 500),
      client("idle", "Charlotte, North Carolina", 0),
    ]);
    expect([...top]).toEqual(["earner"]);
  });

  it("skips clients with no region rather than pooling them", () => {
    const top = assignRegionTopPercentile([
      client("nowhere", null, 9999),
      client("known", "Toledo, Ohio", 5),
    ]);
    expect(top.has("nowhere")).toBe(false);
    expect(top.has("known")).toBe(true);
  });

  it("breaks revenue ties the same way every time", () => {
    const tied = Array.from({ length: 8 }, (_, i) => client(`z${i}`, "Toledo, Ohio", 100));
    const first = assignRegionTopPercentile(tied);
    const again = assignRegionTopPercentile(tied.toReversed());
    expect([...first].toSorted()).toEqual([...again].toSorted());
  });
});

describe("splitExplainer", () => {
  it("says how the shared book was cut", () => {
    expect(splitExplainer(10)).toContain("top 2 of 10");
    expect(splitExplainer(10)).toContain("Chris Voge");
    expect(splitExplainer(10)).toContain("Ryan Bowersock");
  });

  it("says plainly when there is no shared book", () => {
    expect(splitExplainer(0)).toContain("No Columbus or Dayton clients");
  });
});
