import { S3Client } from "npm:@aws-sdk/client-s3";
import { PollyClient } from "npm:@aws-sdk/client-polly";
import "jsr:@std/dotenv/load";

const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
const region = Deno.env.get("AWS_REGION") || "us-east-1";
const bucketName = Deno.env.get("AWS_BUCKET_NAME");

if (!accessKeyId || !secretAccessKey || !bucketName) {
    console.error("❌ Faltan variables de entorno en el archivo .env");
    Deno.exit(1);
}
const config = {
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
};

export const s3Client = new S3Client(config);
export const pollyClient = new PollyClient(config);
export const BUCKET_NAME = bucketName;

console.log("✅ AWS Configurado (Región:", region, ")");