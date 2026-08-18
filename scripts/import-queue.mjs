import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const queuePath = resolve(process.cwd(), process.env.QUEUE_FILE || "data/queue.json");

if (!baseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const records = JSON.parse(await readFile(queuePath, "utf8"));
if (!Array.isArray(records)) throw new Error("Queue file must contain a JSON array.");

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
  Prefer: "return=representation,resolution=merge-duplicates",
};

async function request(path, init) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

let imported = 0;
for (const record of records) {
  if (!record?.brand?.slug || !record?.ad?.source_url || !record?.ad?.format) {
    throw new Error("Each record requires brand.slug, ad.source_url and ad.format.");
  }

  const [brand] = await request("brands?on_conflict=slug", {
    method: "POST",
    body: JSON.stringify(record.brand),
  });

  await request("ads?on_conflict=platform,source_ad_id", {
    method: "POST",
    body: JSON.stringify({
      ...record.ad,
      brand_id: brand.id,
      status: "pending",
      submitted_at: new Date().toISOString(),
    }),
  });
  imported += 1;
}

process.stdout.write(`Queued ${imported} ad record${imported === 1 ? "" : "s"} for review.\n`);
