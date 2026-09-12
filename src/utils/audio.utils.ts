// src/utils/audio.utils.ts
import { join } from "node:path";

export interface MergeAudioOptions {
  bitrate?: string; // default "128k"
  sampleRate?: string; // default "44100"
  format?: string; // default "mp3"
}

/**
 * Une múltiples fragmentos de audio (MP3/WAV/etc.) usando FFmpeg y el demuxer concat.
 * Recodifica con libmp3lame para unificar cabeceras, tiempos y Bitrate Constante (CBR).
 * Evita desincronización y fallos de duración en reproductores frontend.
 */
export async function mergeAudioBuffersWithFFmpeg(
  audioBuffers: Uint8Array[],
  options: MergeAudioOptions = {},
): Promise<Uint8Array> {
  if (!audioBuffers || !Array.isArray(audioBuffers) || audioBuffers.length === 0) {
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

  // 1. Crear directorio temporal único en el sistema
  const tempDir = await Deno.makeTempDir({ prefix: "homero_audio_" });
  const listPath = join(tempDir, "list.txt");
  const outputPath = join(tempDir, "output.mp3");

  try {
    let listContent = "";

    // 2. Guardar cada parte de voz en un archivo temporal (.mp3)
    for (let i = 0; i < audioBuffers.length; i++) {
      const fileName = `part_${i.toString().padStart(4, "0")}.mp3`;
      const partPath = join(tempDir, fileName);
      await Deno.writeFile(partPath, audioBuffers[i]);
      listContent += `file '${fileName}'\n`;
    }

    // 3. Escribir archivo list.txt con la secuencia ordenada
    await Deno.writeTextFile(listPath, listContent);

    // 4. Determinar ejecutable FFmpeg (soporta variable FFMPEG_PATH en .env)
    const ffmpegBin = Deno.env.get("FFMPEG_PATH") || "ffmpeg";

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
      throw new Error(`Error en FFmpeg al concatenar audios (código ${code}): ${errorMsg}`);
    }

    // 6. Leer el archivo unificado resultante
    const finalAudio = await Deno.readFile(outputPath);
    return finalAudio;
  } catch (err: unknown) {
    const error = err as Error;
    if (error?.name === "NotFound" || error?.message?.includes("NotFound")) {
      throw new Error(
        "FFmpeg no está instalado en el sistema o no se encuentra en el PATH. " +
        "Instala FFmpeg o define la variable FFMPEG_PATH en tu archivo .env."
      );
    }
    throw error;
  } finally {
    // 7. Limpiar directorio temporal para no saturar disco
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignorar errores en limpieza de temporales
    }
  }
}
