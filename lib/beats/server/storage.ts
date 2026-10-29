/**
 * Archivio file compatibile S3 (Cloudflare R2 o, con `R2_ENDPOINT`, un altro S3 come Supabase Storage).
 * Il bucket è privato: ogni file esce solo con un URL pre-firmato di breve durata, generato dopo i
 * controlli di accesso. Anche i caricamenti dello staff vanno diretti dal browser al bucket con un
 * URL firmato (i file WAV e gli stems superano di molto il limite di una funzione serverless).
 */
import { GetObjectCommand, HeadObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storeEnv } from "./env";
import { StoreError } from "./errors";

let client: S3Client | null = null;

function r2() {
  const config = storeEnv.r2.config;
  if (!config) throw new StoreError("NOT_CONFIGURED", "Archivio file (R2) non configurato.");
  client ??= new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Gli URL firmati per il browser non devono portarsi dietro checksum che il browser non calcola.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
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

/** URL per caricare un file dal browser con un PUT (stesso Content-Type obbligatorio). */
export async function presignUpload(key: string, contentType: string, expiresIn = 30 * 60): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn });
}

/** Dimensione dell'oggetto caricato, o null se non c'è: si controlla prima di salvare il beat. */
export async function objectSize(key: string): Promise<number | null> {
  const { client, bucket } = r2();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? 0;
  } catch {
    return null;
  }
}

/** CORS del bucket: il browser dello staff può fare PUT diretti dalle origini del sito. */
export async function allowBrowserUploads(origins: string[]): Promise<void> {
  const { client, bucket } = r2();
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [{ AllowedOrigins: origins, AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], MaxAgeSeconds: 3600 }],
      },
    }),
  );
}
