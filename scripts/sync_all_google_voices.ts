// scripts/sync_all_google_voices.ts
import { googleTtsService } from "../src/service/googleTts.service.ts";
import { FOLDER_GOOGLE_VOCES, GOOGLE_VOICES_CATALOG, TEXTO_MUESTRA_DEFAULT } from "../src/config/google.ts";
import { BUCKET_NAME } from "../src/config/aws.ts";

console.log("==================================================");
console.log("🎙️ SINCRONIZACIÓN COMPLETA DE VOCES GOOGLE CLOUD TTS");
console.log("==================================================");
console.log(`📦 Bucket AWS S3: ${BUCKET_NAME}`);
console.log(`📁 Carpeta S3: ${FOLDER_GOOGLE_VOCES}`);
console.log(`🔥 Colección Firestore: ${FOLDER_GOOGLE_VOCES}`);
console.log(`💬 Mensaje de muestra: "${TEXTO_MUESTRA_DEFAULT}"`);
console.log(`👥 Total de voces Google a procesar: ${GOOGLE_VOICES_CATALOG.length}\n`);

const results = await googleTtsService.syncVoicesWithS3AndFirebase(
  TEXTO_MUESTRA_DEFAULT,
  FOLDER_GOOGLE_VOCES
);

const exitosas = results.filter((r) => r.status === "ok");
console.log("\n==================================================");
console.log("🏁 RESUMEN FINAL DE LA SINCRONIZACIÓN GOOGLE TTS");
console.log("==================================================");
console.log(`✅ Voces procesadas con éxito: ${exitosas.length} de ${results.length}`);
if (exitosas.length < results.length) {
  const fallidas = results.filter((r) => r.status === "error");
  console.log(`⚠️ Voces fallidas: ${fallidas.length}`);
  for (const f of fallidas) {
    console.log(`   - ${f.nombre} (${f.id}): ${f.error}`);
  }
}
console.log("==================================================");

Deno.exit(0);
