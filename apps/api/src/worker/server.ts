import Fastify from "fastify";
import { getServerlessEnv } from "../lib/config.js";
import { getJobRecord, updateJobRecord, updateJobState } from "../lib/job-store.js";

const app = Fastify({ logger: true });
const env = getServerlessEnv();
const port = Number(process.env.PORT ?? 8080);

type ProcessPayload = {
  jobId: string;
};

app.post("/process-job", async (request, reply) => {
  const authorization = request.headers.authorization;
  if (authorization !== `Bearer ${env.WORKER_SHARED_SECRET}`) {
    return reply.status(401).send({ error: "Unauthorized worker request." });
  }

  const payload = request.body as ProcessPayload;
  if (!payload?.jobId) {
    return reply.status(400).send({ error: "Missing job id." });
  }

  const existing = await getJobRecord(payload.jobId);
  if (!existing) {
    return reply.status(404).send({ error: "Job not found." });
  }

  if (existing.status === "completed") {
    return reply.status(200).send({ ok: true, message: "Job already completed." });
  }

  await updateJobState(payload.jobId, "processing", "Worker picked up job.", 25);

  try {
    // Placeholder for the next phase: ExifTool processing pipeline and R2 result upload.
    await updateJobRecord(payload.jobId, {
      status: "failed",
      progress: 100,
      message: "Worker processing pipeline is not wired yet.",
      error: "NotImplemented: metadata processing worker",
      retryCount: (existing.retryCount ?? 0) + 1,
    });
    return reply.status(501).send({ error: "Worker pipeline not implemented yet." });
  } catch (error) {
    await updateJobRecord(payload.jobId, {
      status: "failed",
      progress: 100,
      message: "Worker failed during processing.",
      error: error instanceof Error ? error.message : "Unknown worker error",
      retryCount: (existing.retryCount ?? 0) + 1,
    });

    return reply.status(500).send({ error: "Worker failed." });
  }
});

app.get("/health", async () => ({ status: "ok", service: "worker" }));

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
