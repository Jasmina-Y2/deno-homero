import { CATALOGO_VOCES_AZURE } from "../src/controllers/ia.controller.ts";
import "jsr:@std/dotenv/load";

const apiKey = Deno.env.get("AZURE_SPEECH_KEY") || Deno.env.get("AZURE_API_KEY");
const region = Deno.env.get("AZURE_SPEECH_REGION");

console.log("Azure Speech Key:", apiKey ? `Presente (longitud: ${apiKey.length})` : "NO PRESENTE");
console.log("Azure Speech Region:", region);
console.log("Total CATALOGO_VOCES_AZURE:", CATALOGO_VOCES_AZURE.length);

for (const v of CATALOGO_VOCES_AZURE) {
  console.log(`- ${v.key} | ${v.alias} | ${v.id} | ${v.genero} | ${v.codigoIdioma} | ${v.region}`);
}

Deno.exit(0);
