import { CATALOGO_VOCES_AWS_POLLY, resolverMotorPolly } from "../src/controllers/ia.controller.ts";
import { pollyClient, BUCKET_NAME, s3Client } from "../src/config/aws.ts";
import { SynthesizeSpeechCommand } from "npm:@aws-sdk/client-polly";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { db } from "../src/config/firebase.ts";

const TEXT_MESSAGE = "HOLA ESTO ES UNA PRUEBA DE MI VOZ EN HOMERO";
const FOLDER = "VOCES_AUDIO_AWS";

async function syncAllAwsVoices() {
  console.log("==================================================");
  console.log("🎙️ SINCRONIZACIÓN COMPLETA DE VOCES AWS POLLY");
  console.log("==================================================");
  console.log(`📦 Bucket AWS S3: ${BUCKET_NAME}`);
  console.log(`📁 Carpeta S3: ${FOLDER}`);
  console.log(`💬 Mensaje de prueba: "${TEXT_MESSAGE}"`);
  console.log(`👥 Total de voces AWS Polly a procesar: ${CATALOGO_VOCES_AWS_POLLY.length}\n`);

  const resultados: Array<{
    key: string;
    id: string;
    nombre: string;
    motor: string;
    genero: string;
    region: string;
    mp3: string;
    status: "ok" | "error";
    error?: string;
  }> = [];

  for (let i = 0; i < CATALOGO_VOCES_AWS_POLLY.length; i++) {
    const v = CATALOGO_VOCES_AWS_POLLY[i];
    const indexStr = `[${i + 1}/${CATALOGO_VOCES_AWS_POLLY.length}]`;
    console.log(`${indexStr} ⏳ Procesando AWS Polly: ${v.key} - ${v.nombre} (${v.id}, ${v.motor})...`);

    try {
      let engineToUse = resolverMotorPolly(v.id, v.motor);
      let response: any;

      try {
        const command = new SynthesizeSpeechCommand({
          OutputFormat: "mp3",
          Text: `<speak>${TEXT_MESSAGE}</speak>`,
          TextType: "ssml",
          VoiceId: v.id as any,
          Engine: engineToUse as any,
        });
        response = await pollyClient.send(command);
      } catch (errEngine: any) {
        const msg = String(errEngine?.message || errEngine);
        if (msg.includes("does not support the selected engine") || msg.includes("engine")) {
          const alternateEngine = engineToUse === "neural" ? "standard" : "neural";
          console.warn(`   ⚠️ Reintentando con motor alterno '${alternateEngine}'...`);
          const retryCmd = new SynthesizeSpeechCommand({
            OutputFormat: "mp3",
            Text: `<speak>${TEXT_MESSAGE}</speak>`,
            TextType: "ssml",
            VoiceId: v.id as any,
            Engine: alternateEngine as any,
          });
          response = await pollyClient.send(retryCmd);
          engineToUse = alternateEngine;
        } else {
          throw errEngine;
        }
      }

      if (!response.AudioStream) {
        throw new Error("AWS Polly no devolvió AudioStream");
      }

      const audioBytes = await response.AudioStream.transformToByteArray();

      // Subir a AWS S3
      const fileName = `${v.id}_${v.motor}.mp3`;
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

      // Guardar en Firebase Firestore
      const docData = {
        key: v.key,
        id: v.id,
        voiceId: v.id,
        name: v.nombre,
        nombre: v.nombre,
        gender: v.genero,
        genero: v.genero,
        idioma: v.idioma,
        codigoIdioma: v.codigoIdioma,
        region: v.region,
        motor: v.motor,
        motorUtilizado: engineToUse,
        mp3: s3Url,
        audioUrl: s3Url,
        preview_url: s3Url,
        textoPrueba: TEXT_MESSAGE,
        proveedor: "AWS Polly",
        actualizadoEn: new Date().toISOString(),
      };

      // Guardar por KEY (ej. VOICE_0) y por ID_MOTOR (ej. Lupe_standard)
      await db.collection(FOLDER).doc(v.key).set(docData, { merge: true });
      await db.collection(FOLDER).doc(`${v.id}_${v.motor}`).set(docData, { merge: true });

      console.log(`   ✅ S3: ${s3Url}`);
      console.log(`   🔥 Firestore: Documentos ${v.key} y ${v.id}_${v.motor} guardados.`);

      resultados.push({
        key: v.key,
        id: v.id,
        nombre: v.nombre,
        motor: v.motor,
        genero: v.genero,
        region: v.region,
        mp3: s3Url,
        status: "ok",
      });

      // Pausa ligera de 100ms
      await new Promise((r) => setTimeout(r, 100));
    } catch (err: any) {
      console.error(`   ❌ Error procesando voz AWS ${v.nombre}:`, err?.message || err);
      resultados.push({
        key: v.key,
        id: v.id,
        nombre: v.nombre,
        motor: v.motor,
        genero: v.genero,
        region: v.region,
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
  console.log("🏁 RESUMEN FINAL DE LA SINCRONIZACIÓN AWS POLLY");
  console.log("==================================================");
  console.log(`✅ Voces procesadas con éxito: ${exitosas.length} de ${CATALOGO_VOCES_AWS_POLLY.length}`);
  if (exitosas.length < CATALOGO_VOCES_AWS_POLLY.length) {
    const fallidas = resultados.filter((r) => r.status === "error");
    console.log(`⚠️ Voces fallidas: ${fallidas.length}`);
    for (const f of fallidas) {
      console.log(`   - ${f.nombre} (${f.key}): ${f.error}`);
    }
  }
  console.log("==================================================");
}

await syncAllAwsVoices();
Deno.exit(0);
