import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../env.js";

export const cloudflare = new S3Client({
  region: "auto", 

  endpoint: env.CLOUDFLARE_R2_ENDPOINT,

  credentials: {
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});