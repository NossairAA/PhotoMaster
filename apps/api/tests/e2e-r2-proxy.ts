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

  const fileName = "e2e-proxy-upload.jpg";

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
    throw new Error(`upload init failed: ${initResponse.status} ${await initResponse.text()}`);
  }

  const initJson = (await initResponse.json()) as { files: Array<{ id: string }> };
  const fileId = initJson.files[0].id;

  const proxyForm = new FormData();
  proxyForm.append("fileId", fileId);
  proxyForm.append("file", new Blob([jpegBuffer], { type: "image/jpeg" }), fileName);

  const proxyResponse = await fetch(`${API_BASE}/api/uploads/proxy`, {
    method: "POST",
    headers: authHeaders,
    body: proxyForm,
  });

  if (!proxyResponse.ok) {
    throw new Error(`proxy upload failed: ${proxyResponse.status} ${await proxyResponse.text()}`);
  }

  const completeResponse = await fetch(`${API_BASE}/api/uploads/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ fileIds: [fileId] }),
  });

  if (!completeResponse.ok) {
    throw new Error(`upload complete failed: ${completeResponse.status} ${await completeResponse.text()}`);
  }

  const jobResponse = await fetch(`${API_BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      fileIds: [fileId],
      overrides: {
        title: "Proxy E2E",
      },
    }),
  });

  if (!jobResponse.ok) {
    throw new Error(`job creation failed: ${jobResponse.status} ${await jobResponse.text()}`);
  }

  const jobJson = (await jobResponse.json()) as { id: string };

  let done = false;
  for (let i = 0; i < 30; i += 1) {
    const statusResponse = await fetch(`${API_BASE}/api/jobs/${jobJson.id}`, {
      headers: authHeaders,
    });
    if (!statusResponse.ok) {
      throw new Error(`job status failed: ${statusResponse.status} ${await statusResponse.text()}`);
    }

    const statusJson = (await statusResponse.json()) as { status: string; progress: number };
    if (statusJson.status === "completed" && statusJson.progress === 100) {
      done = true;
      break;
    }

    await sleep(1000);
  }

  if (!done) {
    throw new Error("job did not complete in time");
  }

  const downloadResponse = await fetch(`${API_BASE}/api/jobs/${jobJson.id}/download`, {
    headers: authHeaders,
  });
  if (!downloadResponse.ok) {
    throw new Error(`download failed: ${downloadResponse.status} ${await downloadResponse.text()}`);
  }

  const zipBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  const zipText = zipBuffer.toString("latin1");

  if (!zipText.includes(fileName)) {
    throw new Error("zip does not contain expected edited image filename");
  }

  if (zipText.includes("edited/")) {
    throw new Error("zip should place images at root, not inside edited/ folder");
  }

  if (zipText.includes("report.json")) {
    throw new Error("zip should not include report.json");
  }

  console.log("Proxy E2E success.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
