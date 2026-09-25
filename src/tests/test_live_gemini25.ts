import "jsr:@std/dotenv/load";
import { GoogleTtsService } from "../service/googleTts.service.ts";

async function main() {
  const svc = new GoogleTtsService();
  console.log("Iniciando síntesis con Gemini 2.5 Pro TTS...");

  const result = await svc.synthesizeAndUpload({
    text: "(gritando con furia desgarradora y lágrimas de desesperación) ¡No me pidas que me calme! ¿Tienes idea de lo que has hecho? Confié en ti, te di absolutamente todo... ¡y lo arruinaste por completo! ¡No quiero volver a verte en mi vida!",
    voiceName: "Aoede",
    modelName: "gemini-2.5-pro-tts",
    languageCode: "es-MX",
    folder: "HISTORIA"
  });

  console.log("Resultado final:");
  console.log(JSON.stringify(result, null, 2));
}

main();
