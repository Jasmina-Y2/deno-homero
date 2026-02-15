import { Context } from "oak";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { PutObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
import { SynthesizeSpeechCommand } from "npm:@aws-sdk/client-polly";
import { s3Client, pollyClient, BUCKET_NAME } from "../config/aws.ts";


export const getPresignedUrl = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { fileName, fileType, folder = "portadas" } = body;

        if (!fileName || !fileType) {
            ctx.response.status = 400;
            ctx.response.body = { error: "Faltan datos: fileName o fileType" };
            return;
        }
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const key = `${folder}/${uniqueId}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: fileType,
            ACL: "public-read",
        });


        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        ctx.response.body = {
            uploadUrl: uploadUrl,
            publicUrl: uploadUrl.split("?")[0],
            key: key
        };

    } catch (error) {
        console.error("Error generando URL firmada:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Error al generar permisos de subida" };
    }
};
export const generateAudio = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { text, voiceId = "Enrique", engine = "standard" } = body;

        const command = new SynthesizeSpeechCommand({
            OutputFormat: "mp3",
            Text: `<speak>${text}</speak>`,
            TextType: "ssml",
            VoiceId: voiceId,
            Engine: engine
        });

        const response = await pollyClient.send(command);

        if (response.AudioStream) {
            ctx.response.headers.set("Content-Type", "audio/mpeg");
            const audioArray = await response.AudioStream.transformToByteArray();
            ctx.response.body = audioArray;
        } else {
            ctx.response.status = 500;
            ctx.response.body = { error: "AWS no devolvió audio" };
        }

    } catch (error) {
        console.error("Error Polly:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Error generando audio" };
    }
};

export const deleteFile = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { key } = body;

        if (!key) {
            ctx.response.status = 400;
            return;
        }

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);
        ctx.response.body = { success: true, message: "Archivo eliminado" };

    } catch (error) {
        console.error("Error eliminando S3:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Error al eliminar archivo" };
    }
};