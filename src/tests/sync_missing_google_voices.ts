import "jsr:@std/dotenv/load";
import {
  GOOGLE_VOICES_CATALOG,
  FOLDER_GOOGLE_VOCES,
  GoogleVoiceMetadata,
} from "../config/google.ts";
import { BUCKET_NAME, s3Client } from "../config/aws.ts";
import { ListObjectsV2Command, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { db } from "../config/firebase.ts";
import { googleTtsService } from "../service/googleTts.service.ts";

const SAMPLE_TEXT = "Hola, esto es una prueba de mi voz en Homero.";

async function run() {
  console.log(`🔍 1. Consultando archivos existentes en S3: ${BUCKET_NAME}/${FOLDER_GOOGLE_VOCES}...`);

  const listCmd = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: `${FOLDER_GOOGLE_VOCES}/`,
  });

  const s3Res = await s3Client.send(listCmd);
  const existingFiles = new Set<string>();

  if (s3Res.Contents) {
    for (const obj of s3Res.Contents) {
      if (obj.Key) {
        const fileName = obj.Key.replace(`${FOLDER_GOOGLE_VOCES}/`, "").trim();
        if (fileName.endsWith(".mp3")) {
          const voiceName = fileName.replace(".mp3", "").toLowerCase();
          existingFiles.add(voiceName);
        }
      }
    }
  }

  console.log(`📁 Voces ya existentes en S3 (${existingFiles.size}):`, Array.from(existingFiles).join(", "));

  const missingVoices = GOOGLE_VOICES_CATALOG.filter(
    (v) => !existingFiles.has(v.shortName.toLowerCase())
  );

  console.log(`✨ Voces faltantes por generar (${missingVoices.length}):`, missingVoices.map((v) => v.shortName).join(", "));

  const generatedResults = [];

  for (let i = 0; i < missingVoices.length; i++) {
    const v = missingVoices[i];
    console.log(`\n⏳ [${i + 1}/${missingVoices.length}] Generando muestra para: ${v.shortName} (${v.genero})...`);

    try {
      const audioBuffer = await googleTtsService.synthesizeSpeech({
        text: SAMPLE_TEXT,
        voiceName: v.shortName,
        languageCode: "es-MX",
        modelName: "gemini-2.5-pro-tts",
        audioEncoding: "MP3",
      });

      const fileName = `${v.shortName}.mp3`;
      const s3Key = `${FOLDER_GOOGLE_VOCES}/${fileName}`;

      const uploadCmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: "audio/mpeg",
        ACL: "public-read",
      });

      await s3Client.send(uploadCmd);
      const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${FOLDER_GOOGLE_VOCES}/${encodeURIComponent(fileName)}`;

      const docData: GoogleVoiceMetadata = {
        id: v.shortName,
        name: v.shortName,
        nombre: v.shortName,
        shortName: v.shortName,
        idGoogle: `es-US-Chirp3-HD-${v.shortName}`,
        gender: v.gender,
        genero: v.genero,
        languageCode: "es-MX",
        idioma: "Español (Latinoamérica / EE. UU.)",
        descripcion: v.descripcion,
        description: v.descripcion,
        mp3: s3Url,
        audioUrl: s3Url,
        preview_url: s3Url,
        textoPrueba: SAMPLE_TEXT,
        proveedor: "Google Cloud Text-to-Speech (Gemini 2.5 Pro TTS)",
      };

      await db.collection(FOLDER_GOOGLE_VOCES).doc(v.shortName).set(
        { ...docData, actualizadoEn: new Date().toISOString() },
        { merge: true }
      );

      console.log(`   ✅ S3 Subido: ${s3Url}`);
      console.log(`   🔥 Firestore guardado: ${v.shortName}`);

      generatedResults.push({
        shortName: v.shortName,
        genero: v.genero,
        url: s3Url,
      });

      // Pausa breve para evitar saturar cuotas de Google
      await new Promise((r) => setTimeout(r, 600));
    } catch (err: any) {
      console.error(`   ❌ Error en voz ${v.shortName}:`, err?.message || err);
    }
  }

  console.log(`\n🎉 ¡PROCESO FINALIZADO! Se generaron y subieron ${generatedResults.length} voces faltantes a S3.`);
}

run();
