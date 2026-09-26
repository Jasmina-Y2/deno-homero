import "jsr:@std/dotenv/load";
import { googleTtsService } from "../service/googleTts.service.ts";

async function test() {
  const geminiVoicesRes = await googleTtsService.getVoices();
  console.log("Total Gemini en simplify:", geminiVoicesRes.total);
  console.log("Total Gratis:", geminiVoicesRes.totalGratis);
  console.log("Total Premium:", geminiVoicesRes.totalPremium);
  console.log("Voces Oficiales count:", geminiVoicesRes.vocesOficialesGoogle.length);
}

test();
