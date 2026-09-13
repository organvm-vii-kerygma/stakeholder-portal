import { pathToFileURL } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;

type IngestionPayload = {
  status?: unknown;
  chunks?: {
    total?: unknown;
    newest_ingested?: unknown;
    stale_7d?: unknown;
  };
  cursors?: {
    stale?: unknown;
  };
};

export type IngestionHealthOptions = {
  now?: Date;
  maxAgeMs?: number;
  maxStaleChunks?: number;
  maxStaleCursors?: number;
};

export function requireEnvironment(
  env: Record<string, string | undefined>,
  names: string[],
): void {
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  }
}

function finiteNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ingestion health field: ${field}`);
  }
  return number;
}

export function assertIngestionHealth(
  payload: IngestionPayload,
  options: IngestionHealthOptions = {},
): void {
  if (!payload || typeof payload !== "object" || payload.status !== "ok") {
    throw new Error("Ingestion endpoint did not report status=ok");
  }

  const total = finiteNumber(payload.chunks?.total, "chunks.total");
  if (total < 1) {
    throw new Error("Ingestion corpus is empty");
  }

  const newest = payload.chunks?.newest_ingested;
  if (typeof newest !== "string" || !newest.trim()) {
    throw new Error("Ingestion health lacks chunks.newest_ingested");
  }
  const newestMs = Date.parse(newest);
  if (!Number.isFinite(newestMs)) {
    throw new Error("chunks.newest_ingested is not a valid timestamp");
  }

  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? 7 * DAY_MS;
  if (now.getTime() - newestMs > maxAgeMs) {
    throw new Error("Newest ingestion is older than the freshness SLO");
  }

  const staleChunks = finiteNumber(payload.chunks?.stale_7d, "chunks.stale_7d");
  const maxStaleChunks = options.maxStaleChunks ?? 1_000;
  if (staleChunks > maxStaleChunks) {
    throw new Error(
      `Stale chunk count ${staleChunks} exceeds limit ${maxStaleChunks}`,
    );
  }

  const staleCursors = finiteNumber(payload.cursors?.stale, "cursors.stale");
  const maxStaleCursors = options.maxStaleCursors ?? 5;
  if (staleCursors > maxStaleCursors) {
    throw new Error(
      `Stale cursor count ${staleCursors} exceeds limit ${maxStaleCursors}`,
    );
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "require-env") {
    requireEnvironment(process.env, args);
    console.log(`Required configuration present: ${args.join(", ")}`);
    return;
  }
  if (command === "assert-ingestion") {
    const raw = await readStdin();
    const payload = JSON.parse(raw) as IngestionPayload;
    assertIngestionHealth(payload, {
      maxAgeMs: Number(process.env.INGESTION_MAX_AGE_HOURS ?? 168) * 60 * 60 * 1000,
      maxStaleChunks: Number(process.env.INGESTION_MAX_STALE_CHUNKS ?? 1_000),
      maxStaleCursors: Number(process.env.INGESTION_MAX_STALE_CURSORS ?? 5),
    });
    console.log("Ingestion health is within the configured SLO");
    return;
  }
  throw new Error("Usage: operational-health.ts <require-env|assert-ingestion> [...names]");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Operational health check failed: ${message}`);
    process.exitCode = 1;
  });
}
