/**
 * sync-types.ts
 *
 * Fetches the OpenAPI JSON spec from the running API and regenerates
 * src/api.gen.ts with full type definitions.
 *
 * Usage:
 *   pnpm --filter @{slug}/api-client sync-types
 *   # or from monorepo root:
 *   pnpm api-client:sync
 *
 * Requires the API to be running locally (docker compose up + pnpm dev in {slug}-api).
 */

import { exec }      from "node:child_process";
import { writeFile }  from "node:fs/promises";
import { promisify }  from "node:util";
import path           from "node:path";

const run = promisify(exec);

const API_URL   = process.env.API_URL ?? "http://localhost:3001";
const SPEC_URL  = `${API_URL}/docs/json`;
const OUT_FILE  = path.resolve(import.meta.dirname, "../src/api.gen.ts");

async function main() {
  console.log(`Fetching OpenAPI spec from ${SPEC_URL} …`);

  const res = await fetch(SPEC_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch spec: ${res.status} ${res.statusText}\n` +
      `Is the API running? Try: cd {slug}-api && pnpm dev`
    );
  }

  // Write spec to temp file for openapi-typescript to read
  const specJson = await res.text();
  const tmpSpec  = path.resolve(import.meta.dirname, "../openapi.tmp.json");
  await writeFile(tmpSpec, specJson);

  console.log("Generating TypeScript types …");
  const { stdout, stderr } = await run(
    `npx openapi-typescript ${tmpSpec} -o ${OUT_FILE}`
  );
  if (stderr && !stderr.includes("warning")) console.error(stderr);
  if (stdout) console.log(stdout);

  // Clean up temp file
  await run(`rm -f ${tmpSpec}`);

  console.log(`✓ Types written to ${OUT_FILE}`);
  console.log("  Run 'pnpm build' in @{slug}/api-client to rebuild the package.");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
