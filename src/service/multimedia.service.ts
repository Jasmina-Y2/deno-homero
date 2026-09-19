import { Image, decode } from "npm:imagescript@^1.3.0";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { BUCKET_NAME, s3Client } from "../config/aws.ts";

export interface GenerarThumbnailOptions {
  folder?: string;
  captureSecond?: number;
  width?: number;
  height?: number;
  quality?: number;
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
 * Redimensiona y comprime una imagen a 1200x630 (proporción Open Graph) usando ImageScript.
 * Aplica cover (escalado + recorte centrado) para no deformar la imagen y compresión optimizada (calidad 70 por defecto)
 * para un peso sumamente ligero y carga ultrarrápida en WhatsApp y móviles.
 */
export async function redimensionarImagenOG(
  buffer: Uint8Array,
  width = 1200,
  height = 630,
  quality = 70,
): Promise<Uint8Array> {
  const decoded = await decode(buffer);
  if (decoded instanceof Image) {
    decoded.cover(width, height);
    return await decoded.encodeJPEG(quality as any);
  } else if (Array.isArray(decoded) && decoded.length > 0) {
    // Si es un GIF o imagen de múltiples frames, tomar el primer frame
    const frame = decoded[0];
    frame.cover(width, height);
    return await frame.encodeJPEG(quality as any);
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
  captureSecond = 1,
  width = 1200,
  height = 630,
): Promise<Uint8Array> {
  const ffmpegBin = Deno.env.get("FFMPEG_PATH") || "ffmpeg";
  const vfFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

  const executeFFmpeg = async (ssTime: string) => {
    const cmd = new Deno.Command(ffmpegBin, {
      args: [
        "-i",
        videoUrl,
        "-ss",
        ssTime,
        "-vframes",
        "1",
        "-vf",
        vfFilter,
        "-q:v",
        "2",
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

    // Si falló o stdout está vacío, reintentar en 0.5s y luego al inicio
    if (!result.success || result.stdout.length === 0) {
      result = await executeFFmpeg("00:00:00.5");
      if (!result.success || result.stdout.length === 0) {
        result = await executeFFmpeg("00:00:00.1");
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
 * Sube el thumbnail comprimido en formato JPEG a AWS S3 con cabeceras de Cache-Control
 * y retorna la URL pública.
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
    CacheControl: "public, max-age=31536000, immutable",
  });

  await s3Client.send(command);
  const region = Deno.env.get("AWS_REGION") || "us-east-1";
  return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
}

export interface GenerarThumbnailOptions {
  folder?: string;
  captureSecond?: number;
  width?: number;
  height?: number;
  quality?: number;
  customFileName?: string;
  fallbackImageUrl?: string;
  titulo?: string;
}

/**
 * Crea una imagen de respaldo 1200x630 elegante cuando no hay fotogramas ni imágenes disponibles
 */
export async function crearCardOGFallback(
  width = 1200,
  height = 630,
  quality = 70,
): Promise<Uint8Array> {
  const img = new Image(width, height);
  // Fondo oscuro elegante (Dark indigo / slate)
  img.fill(0x181824ff);
  return await img.encodeJPEG(quality as any);
}

/**
 * Función principal para generar thumbnails ultralivianos aptos para WhatsApp y Open Graph (1200x630):
 * 1. Descarga/analiza la URL pública.
 * 2. Determina si es video o imagen.
 * 3. Si es imagen -> Redimensiona y comprime con ImageScript a 1200x630.
 * 4. Si es video -> Extrae fotograma con FFmpeg y comprime a 1200x630 (o usa fallback si FFmpeg no está en el servidor).
 * 5. Sube el thumbnail comprimido a AWS S3 con Cache-Control agresivo.
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
  const quality = options?.quality ?? 70; // Calidad 70: compresión ideal, ultraligera (~30-60KB) y excelente nitidez

  let isVideo = esUrlVideo(mediaUrl);
  let rawFrameBuffer: Uint8Array | null = null;

  if (isVideo) {
    try {
      rawFrameBuffer = await extraerFrameVideoFFmpeg(
        mediaUrl,
        captureSecond,
        width,
        height,
      );
      try {
        rawFrameBuffer = await redimensionarImagenOG(rawFrameBuffer, width, height, quality);
      } catch {}
    } catch (ffmpegErr) {
      console.warn("⚠️ FFmpeg no pudo procesar el video en este entorno:", ffmpegErr);
      // Intentar fallback si se proporcionó una imagen alternativa
      if (options?.fallbackImageUrl && esUrlImagen(options.fallbackImageUrl)) {
        try {
          const res = await fetch(options.fallbackImageUrl);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            rawFrameBuffer = await redimensionarImagenOG(new Uint8Array(arrayBuf), width, height, quality);
          }
        } catch {}
      }
      // Si aún no hay buffer, generar canvas 1200x630 Open Graph
      if (!rawFrameBuffer) {
        rawFrameBuffer = await crearCardOGFallback(width, height, quality);
      }
    }
  } else {
    try {
      const res = await fetch(mediaUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        isVideo = esUrlVideo(mediaUrl, contentType);

        if (isVideo) {
          try {
            rawFrameBuffer = await extraerFrameVideoFFmpeg(mediaUrl, captureSecond, width, height);
            rawFrameBuffer = await redimensionarImagenOG(rawFrameBuffer, width, height, quality);
          } catch {
            rawFrameBuffer = await crearCardOGFallback(width, height, quality);
          }
        } else {
          const arrayBuf = await res.arrayBuffer();
          rawFrameBuffer = await redimensionarImagenOG(new Uint8Array(arrayBuf), width, height, quality);
        }
      }
    } catch (fetchErr) {
      console.warn("⚠️ Error al descargar imagen para OG:", fetchErr);
    }

    if (!rawFrameBuffer) {
      rawFrameBuffer = await crearCardOGFallback(width, height, quality);
    }
  }

  // Subir el thumbnail optimizado a S3
  const publicUrl = await subirThumbnailS3(
    rawFrameBuffer,
    folder,
    options?.customFileName,
  );

  return publicUrl;
}
