import { spawn } from "node:child_process";

const API_PORT = "4001";
const API_URL = `http://localhost:${API_PORT}/health`;
const npmExecPath = process.env.npm_execpath;

if (!npmExecPath) {
  throw new Error("npm_execpath is not set. Run this script through npm scripts.");
}

function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmExecPath, ...args], {
      stdio: "inherit",
      env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForApi(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(API_URL);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("API did not become ready in time.");
}

async function main() {
  const apiEnv = {
    ...process.env,
    PORT: API_PORT,
    AUTH_TEST_BYPASS_TOKEN: process.env.AUTH_TEST_BYPASS_TOKEN ?? "test-token",
  };

  const api = spawn(process.execPath, [npmExecPath, "run", "dev:api"], {
    stdio: "inherit",
    env: apiEnv,
  });

  const shutdown = () => {
    if (api && !api.killed) {
      api.kill("SIGTERM");
    }
  };

  process.on("SIGINT", () => {
    shutdown();
    process.exit(1);
  });
  process.on("SIGTERM", () => {
    shutdown();
    process.exit(1);
  });

  try {
    await run(["run", "test:web"]);
    await waitForApi();
    await run(["run", "test:api"]);
    await run(["run", "test:e2e"], {
      ...process.env,
      API_BASE_URL: `http://localhost:${API_PORT}`,
      AUTH_TEST_BYPASS_TOKEN: process.env.AUTH_TEST_BYPASS_TOKEN ?? "test-token",
    });
  } finally {
    shutdown();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
