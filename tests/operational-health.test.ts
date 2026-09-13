import { describe, expect, it } from "vitest";
import {
  assertIngestionHealth,
  requireEnvironment,
} from "../scripts/operational-health";

const healthy = {
  status: "ok",
  chunks: {
    total: 100,
    newest_ingested: "2026-09-12T12:00:00.000Z",
    stale_7d: 3,
  },
  cursors: { stale: 1 },
};

describe("operational workflow health", () => {
  it("rejects missing required configuration", () => {
    expect(() => requireEnvironment({}, ["DATABASE_URL"])).toThrow(
      "Missing required configuration: DATABASE_URL",
    );
  });

  it("accepts a populated, fresh ingestion report", () => {
    expect(() =>
      assertIngestionHealth(healthy, {
        now: new Date("2026-09-13T12:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  it("rejects an empty corpus", () => {
    expect(() =>
      assertIngestionHealth(
        { ...healthy, chunks: { ...healthy.chunks, total: 0 } },
        { now: new Date("2026-09-13T12:00:00.000Z") },
      ),
    ).toThrow("Ingestion corpus is empty");
  });

  it("rejects a stale newest-ingestion timestamp", () => {
    expect(() =>
      assertIngestionHealth(
        {
          ...healthy,
          chunks: {
            ...healthy.chunks,
            newest_ingested: "2026-09-01T12:00:00.000Z",
          },
        },
        { now: new Date("2026-09-13T12:00:00.000Z") },
      ),
    ).toThrow("older than the freshness SLO");
  });

  it("rejects excessive stale chunks or cursors", () => {
    expect(() =>
      assertIngestionHealth(
        { ...healthy, chunks: { ...healthy.chunks, stale_7d: 1_001 } },
        { now: new Date("2026-09-13T12:00:00.000Z") },
      ),
    ).toThrow("Stale chunk count");

    expect(() =>
      assertIngestionHealth(
        { ...healthy, cursors: { stale: 6 } },
        { now: new Date("2026-09-13T12:00:00.000Z") },
      ),
    ).toThrow("Stale cursor count");
  });
});
