import "jsr:@std/dotenv/load";
import { googleTtsService } from "../service/googleTts.service.ts";

async function test() {
  const data = await googleTtsService.getVoices();
  console.log("Total:", data.total);
  console.log("Total Gratis:", data.totalGratis);
  console.log("Total Premium:", data.totalPremium);
  console.log("Voces Gratis:", data.vocesGratis);
  console.log("Voces Premium:", data.vocesPremium);
  console.log("Ejemplo Voz Premium:", JSON.stringify(data.listaVocesPremium[0], null, 2));
  console.log("Ejemplo Voz Gratis:", JSON.stringify(data.listaVocesGratis[0], null, 2));
}

test();
