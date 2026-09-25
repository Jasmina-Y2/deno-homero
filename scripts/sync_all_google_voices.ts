import lamejs from "npm:@breezystack/lamejs";
import { LISTA_VOCES_GEMINI } from "../src/controllers/ia.controller.ts";
import { BUCKET_NAME, s3Client } from "../src/config/aws.ts";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { db } from "../src/config/firebase.ts";
import "jsr:@std/dotenv/load";

const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_KEY") || Deno.env.get("GOOGLE_API_KEY");
const TEXT_MESSAGE = "HOLA ESTO ES UNA PRUEBA DE MI VOZ EN HOMERO";
const FOLDER = "VOCES_AUDIO_GOOGLE";

const MODELOS_TTS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
];

function pcmToMp3(pcmBytes: Uint8Array, sampleRate = 24000, numChannels = 1, kbps = 128): Uint8Array {
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);
  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Chunks: Uint8Array[] = [];

  const sampleBlockSize = 1152;
  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(endBuf));
  }

  const totalLength = mp3Chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function sintetizarVozGemini(voiceId: string): Promise<Uint8Array> {
  const promptTexto = `Lee el siguiente texto con entonación natural:\n\n${TEXT_MESSAGE}`;
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptTexto }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceId,
          },
        },
      },
    },
  };

  let ultimoError: any = null;

  for (let ronda = 1; ronda <= 3; ronda++) {
    for (const modelo of MODELOS_TTS) {
      try {
        console.log(`      ... intentando modelo ${modelo} (Ronda ${ronda})...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const data = await res.json();
        if (data.error) {
          ultimoError = data.error;
          console.warn(`      ⚠️ Error en ${modelo}:`, data.error?.message || data.error);
          continue;
        }

        const candidateData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (candidateData && candidateData.data) {
          const binaryString = atob(candidateData.data);
          const pcmBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pcmBytes[i] = binaryString.charCodeAt(i);
          }
          return pcmBytes;
        }
      } catch (err: any) {
        ultimoError = err;
        console.warn(`      ⚠️ Excepción en ${modelo}:`, err?.message || err);
      }
    }

    if (ronda < 3) {
      console.log(`      ⏳ Esperando 2s antes de siguiente ronda...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error(`Error en síntesis Gemini: ${ultimoError?.message || JSON.stringify(ultimoError)}`);
}

async function syncAllGoogleVoices() {
  console.log("==================================================");
  console.log("🎙️ SINCRONIZACIÓN COMPLETA DE VOCES GOOGLE GEMINI");
  console.log("==================================================");
  console.log(`📦 Bucket AWS S3: ${BUCKET_NAME}`);
  console.log(`📁 Carpeta S3: ${FOLDER}`);
  console.log(`💬 Mensaje de prueba: "${TEXT_MESSAGE}"`);
  console.log(`👥 Total de voces Google a procesar: ${LISTA_VOCES_GEMINI.length}\n`);

  if (!apiKey) {
    throw new Error("No se ha configurado GEMINI_API_KEY en las variables de entorno.");
  }

  const resultados: Array<{
    id: string;
    nombre: string;
    genero: string;
    mp3: string;
    status: "ok" | "error";
    error?: string;
  }> = [];

  for (let i = 0; i < LISTA_VOCES_GEMINI.length; i++) {
    const v = LISTA_VOCES_GEMINI[i];
    const indexStr = `[${i + 1}/${LISTA_VOCES_GEMINI.length}]`;
    console.log(`${indexStr} ⏳ Procesando Google Gemini: ${v.nombre} (${v.id})...`);

    try {
      const pcmBytes = await sintetizarVozGemini(v.id);
      const mp3Bytes = pcmToMp3(pcmBytes, 24000, 1, 128);

      const fileName = `${v.id}.mp3`;
      const s3Key = `${FOLDER}/${fileName}`;

      const uploadCmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: mp3Bytes,
        ContentType: "audio/mpeg",
        ACL: "public-read",
      });
      await s3Client.send(uploadCmd);

      const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${FOLDER}/${encodeURIComponent(fileName)}`;

      const docData = {
        id: v.id,
        voiceId: v.id,
        name: v.nombre,
        nombre: v.nombre,
        gender: v.genero,
        genero: v.genero,
        multilingue: v.multilingue,
        deteccionAutomaticaIdioma: v.deteccionAutomaticaIdioma,
        idiomasPrincipales: v.idiomasPrincipales,
        codigosIdioma: v.codigosIdioma,
        descripcion: v.descripcion,
        tono: v.tono,
        gratis: v.gratis,
        proveedor: "Google Gemini",
        ejemploPersonaje: v.ejemploPersonaje,
        mp3: s3Url,
        audioUrl: s3Url,
        preview_url: s3Url,
        textoPrueba: TEXT_MESSAGE,
        actualizadoEn: new Date().toISOString(),
      };

      await db.collection(FOLDER).doc(v.id).set(docData, { merge: true });

      console.log(`   ✅ S3: ${s3Url}`);
      console.log(`   🔥 Firestore: Documento ${v.id} guardado.`);

      resultados.push({
        id: v.id,
        nombre: v.nombre,
        genero: v.genero,
        mp3: s3Url,
        status: "ok",
      });

      // Pausa de 500ms
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`   ❌ Error procesando voz Google ${v.nombre}:`, err?.message || err);
      resultados.push({
        id: v.id,
        nombre: v.nombre,
        genero: v.genero,
        mp3: "",
        status: "error",
        error: err?.message || String(err),
      });
    }
  }

  // Guardar documento consolidado _resumen en Firestore
  const exitosas = resultados.filter((r) => r.status === "ok");
  try {
    await db.collection(FOLDER).doc("_resumen").set({
      total: exitosas.length,
      actualizadoEn: new Date().toISOString(),
      voces: exitosas,
    }, { merge: true });
  } catch (err) {
    console.warn("Aviso guardando _resumen en Firestore:", err);
  }

  console.log("\n==================================================");
  console.log("🏁 RESUMEN FINAL DE LA SINCRONIZACIÓN GOOGLE GEMINI");
  console.log("==================================================");
  console.log(`✅ Voces procesadas con éxito: ${exitosas.length} de ${LISTA_VOCES_GEMINI.length}`);
  if (exitosas.length < LISTA_VOCES_GEMINI.length) {
    const fallidas = resultados.filter((r) => r.status === "error");
    console.log(`⚠️ Voces fallidas: ${fallidas.length}`);
    for (const f of fallidas) {
      console.log(`   - ${f.nombre} (${f.id}): ${f.error}`);
    }
  }
  console.log("==================================================");
}

await syncAllGoogleVoices();
Deno.exit(0);
