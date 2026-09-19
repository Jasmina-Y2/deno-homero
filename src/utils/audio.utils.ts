// src/utils/audio.utils.ts
import { join } from "node:path";

export interface MergeAudioOptions {
  bitrate?: string; // default "128k"
  sampleRate?: string; // default "44100"
  format?: string; // default "mp3"
}

/**
 * Une fragmentos de audio MP3 de forma binaria pura en TypeScript sin dependencias externas.
 * Limpia cabeceras ID3 intermedias para que el MP3 resultante sea continuo y compatible con cualquier reproductor.
 */
export function mergeMp3BuffersPureTS(buffers: Uint8Array[]): Uint8Array {
  if (!buffers || buffers.length === 0) {
    return new Uint8Array(0);
  }
  if (buffers.length === 1) {
    return buffers[0];
  }

  const cleanedBuffers: Uint8Array[] = [];

  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    if (!buf || buf.length === 0) continue;

    let start = 0;
    let end = buf.length;

    // Si no es el primer buffer, remover cabecera ID3v2 (inicia con "ID3" = 0x49 0x44 0x33)
    if (
      i > 0 && buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 &&
      buf[2] === 0x33
    ) {
      // El tamaño del tag ID3v2 está codificado en los bytes 6..9 (syncsafe integer: 7 bits por byte)
      const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) |
        ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
      const tagHeaderSize = 10;
      const totalTagSize = tagHeaderSize + size;
      if (totalTagSize < buf.length) {
        start = totalTagSize;
      }
    }

    // Si no es el último buffer, remover tag ID3v1 al final ("TAG" = 0x54 0x41 0x47, 128 bytes)
    if (i < buffers.length - 1 && end - start >= 128) {
      const tagPos = end - 128;
      if (
        buf[tagPos] === 0x54 && buf[tagPos + 1] === 0x41 &&
        buf[tagPos + 2] === 0x47
      ) {
        end = tagPos;
      }
    }

    if (end > start) {
      cleanedBuffers.push(buf.subarray(start, end));
    }
  }

  // Calcular tamaño total y concatenar
  const totalLength = cleanedBuffers.reduce(
    (acc, curr) => acc + curr.length,
    0,
  );
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of cleanedBuffers) {
    result.set(b, offset);
    offset += b.length;
  }

  return result;
}

/**
 * Une múltiples fragmentos de audio (MP3/WAV/etc.).
 * Primero intenta usar FFmpeg si está instalado en el sistema.
 * Si FFmpeg no está disponible (ej. Deno Deploy serverless), usa el motor binario nativo Pure-TS.
 */
export async function mergeAudioBuffersWithFFmpeg(
  audioBuffers: Uint8Array[],
  options: MergeAudioOptions = {},
): Promise<Uint8Array> {
  if (
    !audioBuffers || !Array.isArray(audioBuffers) || audioBuffers.length === 0
  ) {
    throw new Error("No hay fragmentos de audio para unir.");
  }

  // Si solo hay un fragmento, devolverlo directamente
  if (audioBuffers.length === 1) {
    return audioBuffers[0];
  }

  const {
    bitrate = "128k",
    sampleRate = "44100",
  } = options;

  let tempDir: string | null = null;

  try {
    // 1. Determinar ejecutable FFmpeg
    const ffmpegBin = Deno.env.get("FFMPEG_PATH") || "ffmpeg";

    // 2. Crear directorio temporal único en el sistema
    tempDir = await Deno.makeTempDir({ prefix: "homero_audio_" });
    const listPath = join(tempDir, "list.txt");
    const outputPath = join(tempDir, "output.mp3");

    let listContent = "";

    // 3. Guardar cada parte de voz en un archivo temporal (.mp3)
    for (let i = 0; i < audioBuffers.length; i++) {
      const fileName = `part_${i.toString().padStart(4, "0")}.mp3`;
      const partPath = join(tempDir, fileName);
      await Deno.writeFile(partPath, audioBuffers[i]);
      listContent += `file '${fileName}'\n`;
    }

    // 4. Escribir archivo list.txt con la secuencia ordenada
    await Deno.writeTextFile(listPath, listContent);

    // 5. Ejecutar FFmpeg para fusionar y recodificar
    const command = new Deno.Command(ffmpegBin, {
      args: [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c:a",
        "libmp3lame",
        "-ar",
        sampleRate,
        "-b:a",
        bitrate,
        outputPath,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();
    const { code, stderr } = await process.output();

    if (code !== 0) {
      const errorMsg = new TextDecoder().decode(stderr);
      console.warn(
        `⚠️ FFmpeg devolvió código ${code}, utilizando fallback binario nativo:`,
        errorMsg,
      );
      return mergeMp3BuffersPureTS(audioBuffers);
    }

    // 6. Leer el archivo unificado resultante
    const finalAudio = await Deno.readFile(outputPath);
    return finalAudio;
  } catch (err: unknown) {
    console.warn(
      "ℹ️ FFmpeg no disponible en este entorno, uniendo fragmentos con fallback binario nativo...",
    );
    return mergeMp3BuffersPureTS(audioBuffers);
  } finally {
    // 7. Limpiar directorio temporal
    if (tempDir) {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        // Ignorar errores en limpieza de temporales
      }
    }
  }
}
