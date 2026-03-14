import { DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "../config/aws.ts";

export const deleteS3ObjectHelper = async (ruta: string) => {
    try {
        if (!ruta) return;

        const key = ruta.includes(".com/") ? ruta.split(".com/")[1] : ruta;

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);
        console.log(`✅ Archivo eliminado de S3: ${key}`);
    } catch (error) {
        console.warn(`⚠️ Error eliminando archivo S3 (Key: ${ruta}):`, error);
    }
};