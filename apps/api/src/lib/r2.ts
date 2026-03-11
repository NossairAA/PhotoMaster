import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerlessEnv } from "./config.js";

function getClient() {
  const env = getServerlessEnv();
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function createUploadUrl(objectKey: string, contentType: string) {
  const env = getServerlessEnv();
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 120 });
}

export async function confirmObjectExists(objectKey: string) {
  const env = getServerlessEnv();
  const client = getClient();
  await client.send(
    new HeadObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: objectKey,
    }),
  );
}
