import { config as loadEnv } from "dotenv";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ExifTool } from "exiftool-vendored";
import archiver from "archiver";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  createJobSchema,
  fieldCompatibility,
  fields,
  supportedFormats,
  uploadLimits,
  uploadCompleteSchema,
  uploadInitSchema,
  type CreateJobInput,
  type UploadCompleteInput,
  type UploadInitInput,
} from "./schemas.js";
import { type AuthUser, verifyRequestAuth } from "./auth.js";

const explicitEnvPath = path.resolve(process.cwd(), "apps", "api", ".env");
if (existsSync(explicitEnvPath)) {
  loadEnv({ path: explicitEnvPath });
} else {
  loadEnv();
}

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 4000);
const fallbackWebOrigins = ["http://localhost:5173"];
const allowedWebOrigins = Array.from(
  new Set(
    [process.env.WEB_ORIGINS, process.env.WEB_ORIGIN]
      .flatMap((value) => value?.split(",") ?? [])
      .map((value) => value.trim())
      .filter(Boolean),
  ),
);
const r2AccountId = process.env.R2_ACCOUNT_ID ?? "";
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
const r2Bucket = process.env.R2_BUCKET ?? "";

const corsAllowedOrigins = allowedWebOrigins.length > 0 ? allowedWebOrigins : fallbackWebOrigins;

const hasR2Config = Boolean(r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2Bucket);

const r2Client = hasR2Config
  ? new S3Client({
      region: "auto",
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    })
  : null;

type JobFile = {
  id: string;
  name: string;
  format: string;
  status: "queued" | "processing" | "completed" | "failed";
  warnings: string[];
  appliedFields: string[];
  skippedFields: string[];
  verification: Record<string, unknown>;
  outputPath?: string;
  error?: string;
};

type JobRecord = {
  id: string;
  uid: string;
  createdAt: string;
  expiresAt: string;
  status: "queued" | "processing" | "completed";
  message: string;
  requestedFields: string[];
  files: JobFile[];
  processedAt?: string;
  downloadedAt?: string;
  resultObjectKey?: string;
  resultFileName?: string;
};

type UploadedFileRecord = {
  id: string;
  uid: string;
  name: string;
  size: number;
  type: string;
  format: (typeof supportedFormats)[number];
  objectKey: string;
  uploadUrl: string;
  uploaded: boolean;
  uploadedAt: string;
  expiresAt: string;
  jobId?: string;
};

const jobStore = new Map<string, JobRecord>();
const uploadStore = new Map<string, UploadedFileRecord>();
const processedRoot = path.resolve(process.cwd(), "tmp", "processed");
const exiftool = new ExifTool();

const maxFilesPerJob = uploadLimits.maxFilesPerJob;
const maxFileSizeMb = uploadLimits.maxFileSizeMb;
const maxTotalUploadMb = uploadLimits.maxTotalUploadMb;
const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
const maxTotalUploadBytes = maxTotalUploadMb * 1024 * 1024;
const retentionMs = 2 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function expiresIso() {
  return new Date(Date.now() + retentionMs).toISOString();
}

function getRequestAuthUser(request: unknown) {
  const authUser = (request as { authUser?: AuthUser }).authUser;

  if (!authUser) {
    throw new Error("Authenticated user was not attached to request.");
  }

  return authUser;
}

async function deleteUploadedFile(fileId: string) {
  const file = uploadStore.get(fileId);
  if (!file) return;

  if (r2Client && r2Bucket) {
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: r2Bucket,
          Key: file.objectKey,
        }),
      );
    } catch {
      // best effort cleanup
    }
  }

  uploadStore.delete(fileId);
}

async function deleteR2Object(objectKey?: string) {
  if (!objectKey) return;
  if (r2Client && r2Bucket) {
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: r2Bucket,
          Key: objectKey,
        }),
      );
    } catch {
      // best effort cleanup
    }
  }
}

async function cleanupJobUploads(job: JobRecord) {
  for (const file of job.files) {
    await deleteUploadedFile(file.id);
  }
}

async function cleanupProcessedFiles(jobId: string) {
  const jobDir = path.join(processedRoot, jobId);
  try {
    await rm(jobDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
}

async function purgeJob(jobId: string) {
  const job = jobStore.get(jobId);
  if (!job) return;

  await cleanupJobUploads(job);
  await deleteR2Object(job.resultObjectKey);
  await cleanupProcessedFiles(jobId);
  jobStore.delete(jobId);
}

async function runRetentionSweep() {
  const now = Date.now();

  for (const [fileId, file] of uploadStore.entries()) {
    if (new Date(file.expiresAt).getTime() <= now) {
      await deleteUploadedFile(fileId);
    }
  }

  for (const [jobId, job] of jobStore.entries()) {
    if (new Date(job.expiresAt).getTime() <= now) {
      await purgeJob(jobId);
    }
  }
}

function normalizeFormat(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (supportedFormats.includes(ext as (typeof supportedFormats)[number])) {
    return ext as (typeof supportedFormats)[number];
  }

  return null;
}

function sanitizeName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function assertR2Configured() {
  if (!r2Client || !r2Bucket) {
    throw new Error("R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  }

  return { r2Client, r2Bucket };
}

async function createUploadUrl(objectKey: string, contentType: string) {
  const { r2Client: client, r2Bucket: bucket } = assertR2Configured();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 120 });
}

async function confirmObjectExists(objectKey: string) {
  const { r2Client: client, r2Bucket: bucket } = assertR2Configured();
  await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }),
  );
}

async function downloadObjectToPath(objectKey: string, destinationPath: string) {
  const { r2Client: client, r2Bucket: bucket } = assertR2Configured();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error("Downloaded object has empty body.");
  }

  const stream = response.Body as Readable;
  await pipeline(stream, createWriteStream(destinationPath));
}

async function uploadPathToR2(objectKey: string, sourcePath: string, contentType: string) {
  const { r2Client: client, r2Bucket: bucket } = assertR2Configured();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
      Body: createReadStream(sourcePath),
    }),
  );
}

async function createZipArchive(zipPath: string, files: Array<{ path: string; archiveName: string }>) {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    for (const file of files) {
      archive.file(file.path, { name: file.archiveName });
    }
    void archive.finalize();
  });
}

function mapOverridesToExifTags(overrides: CreateJobInput["overrides"]) {
  const tags: Record<string, unknown> = {};
  const appliedFields: string[] = [];
  const skippedFields: string[] = [];

  const applyTag = (field: string, tag: string, value: unknown) => {
    tags[tag] = value;
    appliedFields.push(field);
  };

  if (overrides.dateTimeOriginal) {
    applyTag("dateTimeOriginal", "DateTimeOriginal", overrides.dateTimeOriginal);
    tags.CreateDate = overrides.dateTimeOriginal;
    tags.ModifyDate = overrides.dateTimeOriginal;
  }
  if (typeof overrides.gpsLatitude === "number") applyTag("gpsLatitude", "GPSLatitude", overrides.gpsLatitude);
  if (typeof overrides.gpsLongitude === "number") applyTag("gpsLongitude", "GPSLongitude", overrides.gpsLongitude);
  if (overrides.locationLabel) {
    applyTag("locationLabel", "XMP:Location", overrides.locationLabel);
    tags.City = overrides.locationLabel;
  }
  if (overrides.cameraMake) applyTag("cameraMake", "Make", overrides.cameraMake);
  if (overrides.cameraModel) applyTag("cameraModel", "Model", overrides.cameraModel);
  if (overrides.lensModel) applyTag("lensModel", "LensModel", overrides.lensModel);
  if (typeof overrides.iso === "number") applyTag("iso", "ISO", overrides.iso);
  if (typeof overrides.focalLengthMm === "number") applyTag("focalLengthMm", "FocalLength", overrides.focalLengthMm);
  if (typeof overrides.exposureCompensationEv === "number") {
    applyTag("exposureCompensationEv", "ExposureCompensation", overrides.exposureCompensationEv);
  }
  if (typeof overrides.apertureFNumber === "number") applyTag("apertureFNumber", "FNumber", overrides.apertureFNumber);
  if (overrides.shutterSpeed) applyTag("shutterSpeed", "ExposureTime", overrides.shutterSpeed);

  if (typeof overrides.imageWidth === "number") skippedFields.push("imageWidth");
  if (typeof overrides.imageHeight === "number") skippedFields.push("imageHeight");
  if (typeof overrides.megapixels === "number") skippedFields.push("megapixels");

  if (overrides.title) applyTag("title", "XMP:Title", overrides.title);
  if (overrides.caption) {
    applyTag("caption", "XMP:Description", overrides.caption);
    tags["IPTC:Caption-Abstract"] = overrides.caption;
  }
  if (overrides.keywords && overrides.keywords.length > 0) {
    applyTag("keywords", "XMP:Subject", overrides.keywords);
    tags["IPTC:Keywords"] = overrides.keywords;
  }
  if (overrides.author) {
    applyTag("author", "XMP:Creator", overrides.author);
    tags["IPTC:By-line"] = overrides.author;
  }
  if (overrides.copyright) {
    applyTag("copyright", "XMP:Rights", overrides.copyright);
    tags["IPTC:CopyrightNotice"] = overrides.copyright;
  }

  return { tags, appliedFields: Array.from(new Set(appliedFields)), skippedFields };
}

async function processJob(jobId: string, input: CreateJobInput) {
  const job = jobStore.get(jobId);
  if (!job) return;

  const { tags, appliedFields, skippedFields } = mapOverridesToExifTags(input.overrides);
  const jobProcessedDir = path.join(processedRoot, jobId);

  job.status = "processing";
  job.message = "Applying metadata overrides with ExifTool.";

  try {
    await mkdir(jobProcessedDir, { recursive: true });

    for (const file of job.files) {
      file.status = "processing";
      file.appliedFields = [];
      file.skippedFields = [];
      file.verification = {};

      const uploaded = uploadStore.get(file.id);
      if (!uploaded) {
        file.status = "failed";
        file.error = "Original upload missing or expired before processing.";
        continue;
      }

      const processedPath = path.join(jobProcessedDir, `${file.id}-${sanitizeName(file.name)}`);

      try {
        await downloadObjectToPath(uploaded.objectKey, processedPath);

        if (Object.keys(tags).length > 0) {
          await exiftool.write(processedPath, tags, ["-overwrite_original"]);
        }

        const readback = await exiftool.read(processedPath);
        file.status = "completed";
        file.appliedFields = appliedFields;
        file.skippedFields = skippedFields;
        file.outputPath = processedPath;
        file.verification = {
          make: readback.Make,
          model: readback.Model,
          lensModel: readback.LensModel,
          dateTimeOriginal: readback.DateTimeOriginal,
          gpsLatitude: readback.GPSLatitude,
          gpsLongitude: readback.GPSLongitude,
          title: readback.Title,
          description: readback.Description,
        };
      } catch (error) {
        file.status = "failed";
        file.error = error instanceof Error ? error.message : "Metadata processing failed.";
        try {
          await rm(processedPath, { force: true });
        } catch {
          // ignore best effort cleanup
        }
      } finally {
        await deleteUploadedFile(file.id);
      }
    }

    const failed = job.files.filter((file) => file.status === "failed").length;
    const completed = job.files.filter((file) => file.status === "completed").length;
    job.processedAt = nowIso();
    const processingSummary =
      failed > 0
        ? `Processed with partial failures (${completed} succeeded, ${failed} failed).`
        : `Processed successfully (${completed} files).`;

    job.message = `${processingSummary} Preparing download artifact.`;

    const completedFiles = job.files.filter((file) => file.status === "completed" && file.outputPath);
    const resultFileName = `photomaster-${job.id}.zip`;
    const zipLocalPath = path.join(jobProcessedDir, resultFileName);

    await createZipArchive(
      zipLocalPath,
      completedFiles.map((file) => ({
        path: file.outputPath as string,
        archiveName: file.name,
      })),
    );

    const resultObjectKey = `results/${job.id}/${resultFileName}`;
    await uploadPathToR2(resultObjectKey, zipLocalPath, "application/zip");
    job.resultObjectKey = resultObjectKey;
    job.resultFileName = resultFileName;
    job.expiresAt = expiresIso();
    job.status = "completed";
    job.message = `${processingSummary} Result is ready to download.`;
  } catch (error) {
    job.status = "completed";
    job.message = error instanceof Error ? `Processing failed: ${error.message}` : "Processing failed.";
  } finally {
    await cleanupProcessedFiles(jobId);
  }
}

function buildJobReport(job: JobRecord) {
  return {
    jobId: job.id,
    createdAt: job.createdAt,
    processedAt: job.processedAt ?? null,
    requestedFields: job.requestedFields,
    files: job.files.map((file) => ({
      id: file.id,
      name: file.name,
      format: file.format,
      status: file.status,
      warnings: file.warnings,
      appliedFields: file.appliedFields,
      skippedFields: file.skippedFields,
      verification: file.verification,
      error: file.error ?? null,
    })),
  };
}

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || corsAllowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`), false);
  },
});

app.addHook("preHandler", async (request, reply) => {
  if (!request.url.startsWith("/api")) return;
  if (request.method === "OPTIONS") return;

  const authResult = await verifyRequestAuth(request.headers.authorization);
  if (!authResult.ok) {
    return reply.status(401).send({ error: authResult.error });
  }

  (request as typeof request & { authUser?: AuthUser }).authUser = authResult.user;
});

await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: maxFileSizeBytes,
  },
});

await mkdir(processedRoot, { recursive: true });

app.get("/health", async () => ({ ok: true }));

app.get("/api/config", async () => ({
  formats: supportedFormats,
  fields,
  uploadMode: "signed-url",
  compatibility: fieldCompatibility,
  limits: {
    maxFilesPerJob,
    maxFileSizeMb,
    maxTotalUploadMb,
    retentionSeconds: Math.floor(retentionMs / 1000),
  },
}));

app.post("/api/uploads/init", async (request, reply) => {
  const authUser = getRequestAuthUser(request);

  if (!hasR2Config) {
    return reply.status(500).send({
      error: "R2 is not configured on the server.",
    });
  }

  const parsed = uploadInitSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid upload init body",
      issues: parsed.error.issues,
    });
  }

  const input = parsed.data as UploadInitInput;
  const totalSize = input.files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > maxTotalUploadBytes) {
    return reply.status(413).send({
      error: `Total upload size exceeds limit (${maxTotalUploadMb} MB).`,
    });
  }

  const prepared: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    format: string;
    uploadUrl: string;
    method: "PUT";
  }> = [];

  for (const file of input.files) {
    if (file.size > maxFileSizeBytes) {
      return reply.status(413).send({
        error: `File '${file.name}' exceeds the per-file limit (${maxFileSizeMb} MB).`,
      });
    }

    const normalizedFormat = normalizeFormat(file.name);
    if (!normalizedFormat || normalizedFormat !== file.format) {
      return reply.status(400).send({
        error: `Format mismatch for file '${file.name}'.`,
      });
    }

    const id = randomUUID();
    const objectKey = `uploads/${id}-${sanitizeName(file.name)}`;
    const uploadUrl = await createUploadUrl(objectKey, file.type);

    const record: UploadedFileRecord = {
      id,
      uid: authUser.uid,
      name: file.name,
      size: file.size,
      type: file.type,
      format: file.format,
      objectKey,
      uploadUrl,
      uploaded: false,
      uploadedAt: "",
      expiresAt: expiresIso(),
    };

    uploadStore.set(id, record);
    prepared.push({
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      format: file.format,
      uploadUrl,
      method: "PUT",
    });
  }

  return reply.status(201).send({ files: prepared });
});

app.post("/api/uploads/complete", async (request, reply) => {
  const authUser = getRequestAuthUser(request);
  const parsed = uploadCompleteSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid upload complete body",
      issues: parsed.error.issues,
    });
  }

  const input = parsed.data as UploadCompleteInput;
  const missing: string[] = [];

  for (const fileId of input.fileIds) {
    const record = uploadStore.get(fileId);
    if (!record) {
      missing.push(fileId);
      continue;
    }
    if (record.uid !== authUser.uid) {
      return reply.status(403).send({ error: `Upload does not belong to the authenticated user: ${fileId}` });
    }

    try {
      await confirmObjectExists(record.objectKey);
      record.uploaded = true;
      record.uploadedAt = nowIso();
      record.expiresAt = expiresIso();
    } catch {
      missing.push(fileId);
    }
  }

  if (missing.length > 0) {
    return reply.status(400).send({
      error: "Some uploaded files were not found in storage.",
      missing,
    });
  }

  return reply.send({ ok: true });
});

app.post("/api/uploads/proxy", async (request, reply) => {
  const authUser = getRequestAuthUser(request);
  if (!hasR2Config) {
    return reply.status(500).send({ error: "R2 is not configured on the server." });
  }

  let fileId = "";
  let uploadPart: null | { mimetype: string; body: Buffer } = null;

  for await (const part of request.parts()) {
    if (part.type === "field" && part.fieldname === "fileId") {
      fileId = String(part.value ?? "").trim();
      continue;
    }

    if (part.type === "file" && part.fieldname === "file") {
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      uploadPart = {
        mimetype: part.mimetype || "application/octet-stream",
        body: Buffer.concat(chunks),
      };
    }
  }

  if (!fileId || !uploadPart) {
    return reply.status(400).send({ error: "fileId and file are required." });
  }

  const record = uploadStore.get(fileId);
  if (!record) {
    return reply.status(404).send({ error: "Unknown fileId for upload." });
  }
  if (record.uid !== authUser.uid) {
    return reply.status(403).send({ error: "Upload does not belong to the authenticated user." });
  }

  try {
    const body = uploadPart.body;

    const { r2Client: client, r2Bucket: bucket } = assertR2Configured();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: record.objectKey,
        ContentType: uploadPart.mimetype,
        ContentLength: body.byteLength,
        Body: body,
      }),
    );

    record.uploaded = true;
    record.uploadedAt = nowIso();
    record.expiresAt = expiresIso();
    return reply.send({ ok: true, fileId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy upload failed.";
    return reply.status(500).send({ error: message });
  }
});

app.post("/api/jobs", async (request, reply) => {
  const authUser = getRequestAuthUser(request);
  const parsed = createJobSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      error: "Invalid request body",
      issues: parsed.error.issues,
    });
  }

  const input = parsed.data as CreateJobInput;
  const requestedFields = Object.keys(input.overrides);
  const now = nowIso();

  const missingFileIds = input.fileIds.filter((id) => !uploadStore.has(id));
  if (missingFileIds.length > 0) {
    return reply.status(400).send({
      error: "Some uploaded files are missing or expired.",
      missingFileIds,
    });
  }

  const expiredFileIds = input.fileIds.filter((id) => {
    const record = uploadStore.get(id);
    return !record || new Date(record.expiresAt).getTime() <= Date.now();
  });

  if (expiredFileIds.length > 0) {
    return reply.status(400).send({
      error: "Some uploaded files have already expired. Re-upload and retry.",
      expiredFileIds,
    });
  }

  const claimedFileIds = input.fileIds.filter((id) => {
    const record = uploadStore.get(id);
    return Boolean(record?.jobId);
  });

  const unauthorizedFileIds = input.fileIds.filter((id) => {
    const record = uploadStore.get(id);
    return Boolean(record && record.uid !== authUser.uid);
  });

  const notUploadedFileIds = input.fileIds.filter((id) => {
    const record = uploadStore.get(id);
    return !record?.uploaded;
  });

  if (claimedFileIds.length > 0) {
    return reply.status(400).send({
      error: "Some uploaded files are already attached to another job.",
      claimedFileIds,
    });
  }

  if (unauthorizedFileIds.length > 0) {
    return reply.status(403).send({
      error: "Some uploaded files do not belong to the authenticated user.",
      unauthorizedFileIds,
    });
  }

  if (notUploadedFileIds.length > 0) {
    return reply.status(400).send({
      error: "Some files were not finalized in upload storage.",
      notUploadedFileIds,
    });
  }

  const id = randomUUID();

  const files = input.fileIds.map((fileId) => {
    const file = uploadStore.get(fileId)!;

    return {
      id: fileId,
      name: file.name,
      format: file.format,
      status: "queued" as const,
      warnings:
        file.format === "png" || file.format === "heic" || file.format === "heif"
          ? ["Some EXIF fields may be partially applied on this format."]
        : [],
      appliedFields: [],
      skippedFields: [],
      verification: {},
    };
  });

  const record: JobRecord = {
    id,
    uid: authUser.uid,
    createdAt: now,
    expiresAt: expiresIso(),
    status: "queued",
    message: "Job accepted and waiting for worker.",
    requestedFields,
    files,
  };

  for (const fileId of input.fileIds) {
    const file = uploadStore.get(fileId);
    if (!file) continue;
    file.jobId = id;
    file.expiresAt = expiresIso();
  }

  jobStore.set(id, record);

  void processJob(id, input);

  return reply.status(201).send({
    id,
    status: "queued",
    createdAt: now,
    fileCount: input.fileIds.length,
    requestedFields,
    message: "Job queued. Poll /api/jobs/:id for status updates.",
  });
});

app.get("/api/jobs/:id", async (request, reply) => {
  const authUser = getRequestAuthUser(request);
  const { id } = request.params as { id: string };
  const job = jobStore.get(id);

  if (!job) {
    return reply.status(404).send({ error: "Job not found" });
  }
  if (job.uid !== authUser.uid) {
    return reply.status(403).send({ error: "Job does not belong to the authenticated user." });
  }

  const doneCount = job.files.filter((file) => file.status === "completed" || file.status === "failed").length;
  const progress = Math.round((doneCount / job.files.length) * 100);

  return {
    ...job,
    fileCount: job.files.length,
    progress,
  };
});

app.get("/api/jobs/:id/download", async (request, reply) => {
  const authUser = getRequestAuthUser(request);
  const { id } = request.params as { id: string };
  const job = jobStore.get(id);

  if (!job) {
    return reply.status(404).send({ error: "Job not found" });
  }
  if (job.uid !== authUser.uid) {
    return reply.status(403).send({ error: "Job does not belong to the authenticated user." });
  }

  if (job.status !== "completed") {
    return reply.status(409).send({ error: "Job is not ready for download yet." });
  }

  if (job.downloadedAt) {
    return reply.status(410).send({ error: "Download has already been claimed and cleaned up." });
  }

  if (!job.resultObjectKey || !job.resultFileName) {
    return reply.status(409).send({ error: "No downloadable artifact is available for this job." });
  }

  job.downloadedAt = nowIso();
  job.message = "Download claimed. Cleaning storage artifacts.";

  const { r2Client: client, r2Bucket: bucket } = assertR2Configured();
  const resultResponse = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: job.resultObjectKey,
    }),
  );

  if (!resultResponse.Body) {
    await purgeJob(id);
    return reply.status(410).send({ error: "Result artifact has already been removed." });
  }

  const stream = resultResponse.Body as Readable;

  stream.on("close", () => {
    void purgeJob(id);
  });

  stream.on("error", () => {
    void purgeJob(id);
  });

  reply.header("Content-Type", "application/zip");
  reply.header("Content-Disposition", `attachment; filename="${job.resultFileName}"`);
  return reply.send(stream);
});

app.delete("/api/jobs/:id", async (request, reply) => {
  const authUser = getRequestAuthUser(request);
  const { id } = request.params as { id: string };
  const job = jobStore.get(id);

  if (!job) {
    return reply.status(204).send();
  }
  if (job.uid !== authUser.uid) {
    return reply.status(403).send({ error: "Job does not belong to the authenticated user." });
  }

  await purgeJob(id);
  return reply.status(204).send();
});

setInterval(() => {
  void runRetentionSweep();
}, 30_000);

process.once("exit", () => {
  void exiftool.end();
});

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
