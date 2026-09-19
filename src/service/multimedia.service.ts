import { Image, decode } from "npm:imagescript@^1.3.0";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { BUCKET_NAME, s3Client } from "../config/aws.ts";

export interface GenerarThumbnailOptions {
  folder?: string;
  captureSecond?: number;
  width?: number;
  height?: number;
  customFileName?: string;
}

/**
 * Detecta si una URL o Content-Type corresponde a un video.
 */
export function esUrlVideo(url: string, contentType?: string | null): boolean {
  if (contentType) {
    if (contentType.toLowerCase().startsWith("video/")) return true;
    if (contentType.toLowerCase().startsWith("image/")) return false;
  }
  if (!url || typeof url !== "string") return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  const videoExtensions = [
    ".mp4",
    ".mov",
    ".webm",
    ".avi",
    ".mkv",
    ".m4v",
    ".3gp",
    ".flv",
    ".ogv",
    ".ts",
    ".wmv",
  ];
  return videoExtensions.some((ext) => cleanUrl.endsWith(ext));
}

/**
 * Detecta si una URL o Content-Type corresponde a una imagen.
 */
export function esUrlImagen(url: string, contentType?: string | null): boolean {
  if (contentType) {
    if (contentType.toLowerCase().startsWith("image/")) return true;
    if (contentType.toLowerCase().startsWith("video/")) return false;
  }
  if (!url || typeof url !== "string") return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tiff",
    ".svg",
    ".avif",
  ];
  return imageExtensions.some((ext) => cleanUrl.endsWith(ext));
}

/**
 * Redimensiona una imagen a 1200x630 (proporción Open Graph) usando ImageScript.
 * Aplica cover (escalado + recorte centrado) para no deformar la imagen.
 */
export async function redimensionarImagenOG(
  buffer: Uint8Array,
  width = 1200,
  height = 630,
): Promise<Uint8Array> {
  const decoded = await decode(buffer);
  if (decoded instanceof Image) {
    decoded.cover(width, height);
    return await decoded.encodeJPEG(85);
  } else if (Array.isArray(decoded) && decoded.length > 0) {
    // Si es un GIF o imagen de múltiples frames, tomar el primer frame
    const frame = decoded[0];
    frame.cover(width, height);
    return await frame.encodeJPEG(85);
  } else {
    throw new Error("Formato de imagen no soportado para redimensionar.");
  }
}

/**
 * Extrae un fotograma de video usando FFmpeg a través de Deno.Command.
 * Captura a los segundos indicados (por defecto 2s) y escala/recorta a 1200x630.
 */
export async function extraerFrameVideoFFmpeg(
  videoUrl: string,
  captureSecond = 2,
  width = 1200,
  height = 630,
): Promise<Uint8Array> {
  const ffmpegBin = Deno.env.get("FFMPEG_PATH") || "ffmpeg";
  const vfFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

  const executeFFmpeg = async (ssTime: string) => {
    const cmd = new Deno.Command(ffmpegBin, {
      args: [
        "-ss",
        ssTime,
        "-i",
        videoUrl,
        "-vframes",
        "1",
        "-vf",
        vfFilter,
        "-f",
        "image2",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ],
      stdout: "piped",
      stderr: "piped",
    });
    return await cmd.output();
  };

  try {
    let result = await executeFFmpeg(captureSecond.toString());

    // Si falló o stdout está vacío (por ej. si el video dura menos que captureSecond), reintentar al inicio
    if (!result.success || result.stdout.length === 0) {
      result = await executeFFmpeg("00:00:00.5");
      if (!result.success || result.stdout.length === 0) {
        result = await executeFFmpeg("00:00:00");
      }
    }

    if (!result.success || result.stdout.length === 0) {
      const errDetail = new TextDecoder().decode(result.stderr);
      throw new Error(`FFmpeg no pudo generar el fotograma: ${errDetail.trim()}`);
    }

    return result.stdout;
  } catch (error) {
    console.error("❌ Error ejecutando FFmpeg para extraer fotograma:", error);
    throw error;
  }
}

/**
 * Sube el thumbnail en formato JPEG a AWS S3 y retorna la URL pública.
 */
export async function subirThumbnailS3(
  buffer: Uint8Array,
  folder = "thumbnails",
  customFileName?: string,
): Promise<string> {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const fileName = customFileName || `thumb_${uniqueId}.jpg`;
  const key = `${folder}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: "image/jpeg",
    ACL: "public-read",
  });

  await s3Client.send(command);
  const region = Deno.env.get("AWS_REGION") || "us-east-1";
  return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Función principal para generar thumbnails aptos para WhatsApp y Open Graph (1200x630):
 * 1. Descarga/analiza la URL pública.
 * 2. Determina si es video o imagen.
 * 3. Si es imagen -> Redimensiona con ImageScript a 1200x630.
 * 4. Si es video -> Extrae fotograma con FFmpeg a los segundos posteriores y escala a 1200x630.
 * 5. Sube el thumbnail a AWS S3.
 * 6. Retorna la nueva URL pública de S3.
 */
export async function generarThumbnailOGService(
  mediaUrl: string,
  options?: GenerarThumbnailOptions,
): Promise<string> {
  if (!mediaUrl || typeof mediaUrl !== "string" || mediaUrl.trim() === "") {
    throw new Error("URL multimedia inválida o vacía");
  }

  const folder = options?.folder || "thumbnails";
  const captureSecond = options?.captureSecond ?? 2;
  const width = options?.width ?? 1200;
  const height = options?.height ?? 630;

  // 1. Verificar primero si por extensión es video
  let isVideo = esUrlVideo(mediaUrl);
  let thumbnailBuffer: Uint8Array;

  if (isVideo) {
    // Si es video, llamar directamente a FFmpeg con la URL
    thumbnailBuffer = await extraerFrameVideoFFmpeg(
      mediaUrl,
      captureSecond,
      width,
      height,
    );
  } else {
    // Si no tiene extensión clara de video, hacer fetch para obtener contentType y buffer
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      throw new Error(
        `Error al descargar archivo desde URL (${res.status} ${res.statusText}): ${mediaUrl}`,
      );
    }

    const contentType = res.headers.get("content-type");
    isVideo = esUrlVideo(mediaUrl, contentType);

    if (isVideo) {
      thumbnailBuffer = await extraerFrameVideoFFmpeg(
        mediaUrl,
        captureSecond,
        width,
        height,
      );
    } else {
      const arrayBuf = await res.arrayBuffer();
      const imageBytes = new Uint8Array(arrayBuf);
      thumbnailBuffer = await redimensionarImagenOG(imageBytes, width, height);
    }
  }

  // 2. Subir el thumbnail generado a S3
  const publicUrl = await subirThumbnailS3(
    thumbnailBuffer,
    folder,
    options?.customFileName,
  );

  return publicUrl;
}
