import { CATALOGO_VOCES_AZURE } from "../src/controllers/ia.controller.ts";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { BUCKET_NAME, s3Client } from "../src/config/aws.ts";
import { db } from "../src/config/firebase.ts";
import "jsr:@std/dotenv/load";

const apiKey = Deno.env.get("AZURE_SPEECH_KEY") || Deno.env.get("AZURE_API_KEY");
const region = Deno.env.get("AZURE_SPEECH_REGION") || "canadacentral";
const TEXT_MESSAGE = "HOLA ESTO ES UNA PRUEBA DE MI VOZ EN HOMERO";
const FOLDER = "VOCES_AUDIO_AZURE";

async function syncAllAzureVoices() {
  console.log("==================================================");
  console.log("🎙️ SINCRONIZACIÓN COMPLETA DE VOCES AZURE NEURAL");
  console.log("==================================================");
  console.log(`📦 Bucket AWS S3: ${BUCKET_NAME}`);
  console.log(`📁 Carpeta S3: ${FOLDER}`);
  console.log(`💬 Mensaje de prueba: "${TEXT_MESSAGE}"`);
  console.log(`👥 Total de voces Azure a procesar: ${CATALOGO_VOCES_AZURE.length}\n`);

  if (!apiKey) {
    throw new Error("No se ha configurado AZURE_SPEECH_KEY en las variables de entorno.");
  }

  const resultados: Array<{
    id: string;
    key: string;
    alias: string;
    nombre: string;
    genero: string;
    codigoIdioma: string;
    mp3: string;
    status: "ok" | "error";
    error?: string;
  }> = [];

  const azureUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  for (let i = 0; i < CATALOGO_VOCES_AZURE.length; i++) {
    const voice = CATALOGO_VOCES_AZURE[i];
    const indexStr = `[${i + 1}/${CATALOGO_VOCES_AZURE.length}]`;
    console.log(`${indexStr} ⏳ Procesando Azure: ${voice.alias} (${voice.nombre}) - ${voice.id}...`);

    try {
      // 1. Generar audio con Azure Neural TTS
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.codigoIdioma}">
  <voice name="${voice.id}">
    ${TEXT_MESSAGE}
  </voice>
</speak>`;

      const res = await fetch(azureUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "HomeroDenoApp",
        },
        body: ssml,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Azure TTS error (${res.status}): ${errText}`);
      }

      const audioBytes = new Uint8Array(await res.arrayBuffer());

      // 2. Subir a AWS S3
      const fileName = `${voice.alias}.mp3`;
      const s3Key = `${FOLDER}/${fileName}`;

      const uploadCmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: audioBytes,
        ContentType: "audio/mpeg",
        ACL: "public-read",
      });
      await s3Client.send(uploadCmd);

      const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${FOLDER}/${encodeURIComponent(fileName)}`;

      // 3. Guardar en Firebase Firestore
      const docData = {
        id: voice.id,
        voiceId: voice.id,
        key: voice.key,
        alias: voice.alias,
        name: voice.nombre,
        nombre: voice.nombre,
        gender: voice.genero,
        genero: voice.genero,
        idioma: voice.idioma,
        codigoIdioma: voice.codigoIdioma,
        region: voice.region,
        motor: voice.motor,
        estilos: voice.estilos || [],
        descripcion: voice.descripcion,
        description: voice.descripcion,
        mp3: s3Url,
        audioUrl: s3Url,
        preview_url: s3Url,
        textoPrueba: TEXT_MESSAGE,
        proveedor: "Microsoft Azure Cognitive Services Speech (Neural)",
        actualizadoEn: new Date().toISOString(),
      };

      await db.collection(FOLDER).doc(voice.id).set(docData, { merge: true });

      console.log(`   ✅ S3: ${s3Url}`);
      console.log(`   🔥 Firestore: Documento ${voice.id} guardado.`);

      resultados.push({
        id: voice.id,
        key: voice.key,
        alias: voice.alias,
        nombre: voice.nombre,
        genero: voice.genero,
        codigoIdioma: voice.codigoIdioma,
        mp3: s3Url,
        status: "ok",
      });

      // Pausa ligera de 150ms entre llamadas
      await new Promise((r) => setTimeout(r, 150));
    } catch (err: any) {
      console.error(`   ❌ Error procesando voz ${voice.alias}:`, err?.message || err);
      resultados.push({
        id: voice.id,
        key: voice.key,
        alias: voice.alias,
        nombre: voice.nombre,
        genero: voice.genero,
        codigoIdioma: voice.codigoIdioma,
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
  console.log("🏁 RESUMEN FINAL DE LA SINCRONIZACIÓN AZURE");
  console.log("==================================================");
  console.log(`✅ Voces procesadas con éxito: ${exitosas.length} de ${CATALOGO_VOCES_AZURE.length}`);
  if (exitosas.length < CATALOGO_VOCES_AZURE.length) {
    const fallidas = resultados.filter((r) => r.status === "error");
    console.log(`⚠️ Voces fallidas: ${fallidas.length}`);
    for (const f of fallidas) {
      console.log(`   - ${f.alias} (${f.id}): ${f.error}`);
    }
  }
  console.log("==================================================");
}

await syncAllAzureVoices();
Deno.exit(0);
