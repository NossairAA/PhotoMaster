import { writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";
const AUTH_TOKEN = process.env.AUTH_TEST_BYPASS_TOKEN ?? "test-token";
const authHeaders = { Authorization: `Bearer ${AUTH_TOKEN}` };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const jpegBase64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEBAPDw8QDw8QEA8PDw8QFREWFhURExUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGi0fHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAEBQIDBgEAB//EADYQAAIBAgQDBQYEBwAAAAAAAAECAAMRBBIhMQVBUQYiYXGBEzKRobHB0RQjQlJicuHwFf/EABkBAAMBAQEAAAAAAAAAAAAAAAABAgMEBf/EACMRAAICAgICAgMBAAAAAAAAAAABAhEDIRIxBEETIlEUYYH/2gAMAwEAAhEDEQA/APb6KUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/Z";
  const jpegBuffer = Buffer.from(jpegBase64, "base64");

  const fileName = "e2e-signed-upload.jpg";

  const initResponse = await fetch(`${API_BASE}/api/uploads/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      files: [
        {
          name: fileName,
          size: jpegBuffer.byteLength,
          type: "image/jpeg",
          format: "jpg",
        },
      ],
    }),
  });

  if (!initResponse.ok) {
    const text = await initResponse.text();
    throw new Error(`upload init failed: ${initResponse.status} ${text}`);
  }

  const initJson = (await initResponse.json()) as {
    files: Array<{ id: string; uploadUrl: string; method: "PUT" }>;
  };

  const target = initJson.files[0];
  const putResponse = await fetch(target.uploadUrl, {
    method: target.method,
    headers: { "Content-Type": "image/jpeg" },
    body: jpegBuffer,
  });

  if (!putResponse.ok) {
    const text = await putResponse.text();
    throw new Error(`signed upload failed: ${putResponse.status} ${text}`);
  }

  const completeResponse = await fetch(`${API_BASE}/api/uploads/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ fileIds: [target.id] }),
  });

  if (!completeResponse.ok) {
    const text = await completeResponse.text();
    throw new Error(`upload complete failed: ${completeResponse.status} ${text}`);
  }

  const jobResponse = await fetch(`${API_BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      fileIds: [target.id],
      overrides: {
        title: "E2E Test",
        dateTimeOriginal: "2026:02:08 16:19:58",
      },
    }),
  });

  if (!jobResponse.ok) {
    const text = await jobResponse.text();
    throw new Error(`job creation failed: ${jobResponse.status} ${text}`);
  }

  const jobJson = (await jobResponse.json()) as { id: string };
  const jobId = jobJson.id;

  let done = false;
  for (let i = 0; i < 30; i += 1) {
    const statusResponse = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
      headers: authHeaders,
    });
    if (!statusResponse.ok) {
      const text = await statusResponse.text();
      throw new Error(`job status failed: ${statusResponse.status} ${text}`);
    }

    const statusJson = (await statusResponse.json()) as { status: string; progress: number };
    if (statusJson.status === "completed" && statusJson.progress === 100) {
      done = true;
      break;
    }

    await sleep(1000);
  }

  if (!done) {
    throw new Error("job did not complete within timeout");
  }

  const downloadResponse = await fetch(`${API_BASE}/api/jobs/${jobId}/download`, {
    headers: authHeaders,
  });
  if (!downloadResponse.ok) {
    const text = await downloadResponse.text();
    throw new Error(`download failed: ${downloadResponse.status} ${text}`);
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuffer);
  const zipText = zipBuffer.toString("latin1");

  if (!zipText.includes(fileName)) {
    throw new Error("zip does not contain expected image filename");
  }

  if (zipText.includes("edited/")) {
    throw new Error("zip should place images at root, not inside edited/ folder");
  }

  const outputPath = path.resolve(process.cwd(), "tests", `e2e-result-${jobId}.zip`);
  await writeFile(outputPath, zipBuffer);

  console.log(`E2E success. Output saved to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
