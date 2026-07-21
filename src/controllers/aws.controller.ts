import { Context } from "oak";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "npm:@aws-sdk/client-s3";
import { SynthesizeSpeechCommand } from "npm:@aws-sdk/client-polly";
import { BUCKET_NAME, pollyClient, s3Client } from "../config/aws.ts";
import { deleteS3ObjectHelper } from "../service/aws.service.ts";

export const getPresignedUrl = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { fileName, fileType, folder = "portadas" } = body;

    if (!fileName || !fileType) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Faltan datos: fileName o fileType" };
      return;
    }
    const uniqueId = `${Date.now()}-${
      Math.random().toString(36).substring(2, 8)
    }`;
    const key = `${folder}/${uniqueId}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    ctx.response.body = {
      uploadUrl: uploadUrl,
      publicUrl: uploadUrl.split("?")[0],
      key: key,
    };
  } catch (error) {
    console.error("Error generando URL firmada:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error al generar permisos de subida" };
  }
};

export const uploadToS3 = async (
  buffer: Uint8Array,
  fileName: string,
  fileType: string,
) => {
  try {
    const uniqueId = `${Date.now()}-${
      Math.random().toString(36).substring(2, 8)
    }`;
    const key = `profile/${uniqueId}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: fileType,
      ACL: "public-read",
    });

    await s3Client.send(command);
    return `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
  } catch (error) {
    console.error("❌ Error subiendo a S3:", error);
    throw error;
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
      Engine: engine,
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

export const deleteFileController = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { key } = body;

    if (!key) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "Falta la key" };
      return;
    }
    await deleteS3ObjectHelper(key);

    ctx.response.status = 200;
    ctx.response.body = { success: true, message: "Archivo eliminado" };
  } catch (error) {
    console.error("Error controller S3:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error al eliminar archivo" };
  }
};

export const obtenerUrlLectura = async (ctx: any) => {
  try {
    const body = await ctx.request.body.json();
    const { key } = body;

    if (!key) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el 'key' del archivo",
      };
      return;
    }
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    ctx.response.body = { success: true, url };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: error };
  }
};

export const eliminarArchivoS3 = async (ctx: any) => {
  try {
    const body = await ctx.request.body.json();
    const { ruta } = body;

    if (!ruta) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta la 'ruta' del archivo",
      };
      return;
    }

    let key = ruta;

    if (ruta.includes(".com/")) {
      key = ruta.split(".com/")[1];
    }

    key = key.split("?")[0];

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    ctx.response.body = {
      success: true,
      message: "Archivo eliminado correctamente",
    };
  } catch (error) {
    console.error("Error al eliminar archivo S3:", error);
    ctx.response.status = 500;
    ctx.response.body = { success: false, error: error };
  }
};
