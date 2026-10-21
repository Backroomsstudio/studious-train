/**
 * Cloudflare R2 (API compatibile S3). Il bucket è privato: ogni file esce solo con un URL
 * pre-firmato di breve durata, generato dopo i controlli di accesso.
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storeEnv } from "./env";
import { StoreError } from "./errors";

let client: S3Client | null = null;

function r2() {
  const config = storeEnv.r2.config;
  if (!config) throw new StoreError("NOT_CONFIGURED", "Archivio file (R2) non configurato.");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return { client, bucket: config.bucket };
}

export async function presignObject(
  key: string,
  options: { expiresIn: number; downloadName?: string; contentType?: string },
): Promise<string> {
  const { client, bucket } = r2();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: options.downloadName
      ? `attachment; filename="${options.downloadName.replace(/[^\w.\- ]/g, "_")}"`
      : undefined,
    ResponseContentType: options.contentType,
    ResponseCacheControl: "private, no-store",
  });
  return getSignedUrl(client, command, { expiresIn: options.expiresIn });
}
