import { getServerlessEnv } from "./config.js";

type QueuePayload = {
  jobId: string;
};

export async function enqueueJob(payload: QueuePayload) {
  const env = getServerlessEnv();
  const publishUrl = `https://qstash.upstash.io/v2/publish/${encodeURIComponent(env.WORKER_URL)}`;

  const response = await fetch(publishUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Forward-Authorization": `Bearer ${env.WORKER_SHARED_SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to enqueue job (${response.status}) ${text}`);
  }

  return response.json();
}
