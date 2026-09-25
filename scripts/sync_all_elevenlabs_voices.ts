import { ElevenLabsService } from "../src/service/elevenlabs.service.ts";
import { SPANISH_VOICES } from "../src/config/elevenlabs.ts";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { BUCKET_NAME, s3Client } from "../src/config/aws.ts";
import { db } from "../src/config/firebase.ts";

const TEXT_MESSAGE = "HOLA ESTO ES UNA PRUEBA DE MI VOZ EN HOMERO";
const FOLDER = "VOCES_AUDIO_ELEVENSLAB";

async function syncAllVoices() {
  console.log("==================================================");
  console.log("🎙️ SINCRONIZACIÓN COMPLETA DE VOCES ELEVENLABS");
  console.log("==================================================");
  console.log(`📦 Bucket AWS S3: ${BUCKET_NAME}`);
  console.log(`📁 Carpeta S3: ${FOLDER}`);
  console.log(`💬 Mensaje de prueba: "${TEXT_MESSAGE}"`);
  console.log(`👥 Total de voces a procesar: ${SPANISH_VOICES.length}\n`);

  const service = new ElevenLabsService();
  const apiKey = await service.getApiKey();
  console.log(`🔑 ElevenLabs API Key autenticada correctamente.`);

  const resultados: Array<{
    id: string;
    name: string;
    gender: string;
    mp3: string;
    status: "ok" | "error";
    error?: string;
  }> = [];

  for (let i = 0; i < SPANISH_VOICES.length; i++) {
    const voice = SPANISH_VOICES[i];
    const indexStr = `[${i + 1}/${SPANISH_VOICES.length}]`;
    console.log(`${indexStr} ⏳ Procesando voz: ${voice.name} (${voice.gender}) - ID: ${voice.id}...`);

    try {
      // 1. Generar audio en ElevenLabs
      const audioBuffer = await service.generateAudio(TEXT_MESSAGE, voice.id);
      
      // 2. Subir a AWS S3
      const fileName = `${voice.name}.mp3`;
      const s3Key = `${FOLDER}/${fileName}`;
      
      const uploadCmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: "audio/mpeg",
        ACL: "public-read",
      });
      await s3Client.send(uploadCmd);

      const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${FOLDER}/${encodeURIComponent(fileName)}`;

      // 3. Guardar en Firebase Firestore
      const voiceDocData = {
        id: voice.id,
        voiceId: voice.id,
        name: voice.name,
        nombre: voice.name,
        gender: voice.gender,
        genero: voice.gender,
        mp3: s3Url,
        audioUrl: s3Url,
        preview_url: s3Url,
        textoPrueba: TEXT_MESSAGE,
        description: voice.description,
        descripcion: voice.description,
        idioma: voice.idioma,
        language: voice.language,
        codigoIdioma: voice.codigoIdioma,
        idiomasSoportados: voice.idiomasSoportados,
        multilingue: voice.multilingue,
        actualizadoEn: new Date().toISOString(),
      };

      // Guardar en la colección 'VOCES_AUDIO_ELEVENSLAB' con ID = voice.id
      await db.collection("VOCES_AUDIO_ELEVENSLAB").doc(voice.id).set(voiceDocData, { merge: true });

      // También guardar en subcolección ELEVENS/VOCES/voces si aplica
      try {
        await db.collection("ELEVENS").doc("VOCES").collection("voces").doc(voice.id).set(voiceDocData, { merge: true });
      } catch {
        // Ignorar si no se usa
      }

      console.log(`   ✅ S3: ${s3Url}`);
      console.log(`   🔥 Firestore: Documento ${voice.id} guardado.`);

      resultados.push({
        id: voice.id,
        name: voice.name,
        gender: voice.gender,
        mp3: s3Url,
        status: "ok",
      });

      // Pausa ligera de 300ms entre llamadas para no saturar rate-limits
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err: any) {
      console.error(`   ❌ Error procesando voz ${voice.name}:`, err?.message || err);
      resultados.push({
        id: voice.id,
        name: voice.name,
        gender: voice.gender,
        mp3: "",
        status: "error",
        error: err?.message || String(err),
      });
    }
  }

  // Guardar documento consolidado en Firestore con todas las voces
  const exitosas = resultados.filter((r) => r.status === "ok");
  try {
    await db.collection("VOCES_AUDIO_ELEVENSLAB").doc("_resumen").set({
      total: exitosas.length,
      actualizadoEn: new Date().toISOString(),
      voces: exitosas,
    }, { merge: true });
  } catch (err) {
    console.warn("Aviso guardando _resumen en Firestore:", err);
  }

  console.log("\n==================================================");
  console.log("🏁 RESUMEN FINAL DE LA SINCRONIZACIÓN");
  console.log("==================================================");
  console.log(`✅ Voces procesadas con éxito: ${exitosas.length} de ${SPANISH_VOICES.length}`);
  if (exitosas.length < SPANISH_VOICES.length) {
    const fallidas = resultados.filter((r) => r.status === "error");
    console.log(`⚠️ Voces fallidas: ${fallidas.length}`);
    for (const f of fallidas) {
      console.log(`   - ${f.name} (${f.id}): ${f.error}`);
    }
  }
  console.log("==================================================");
}

await syncAllVoices();
Deno.exit(0);
