import "jsr:@std/dotenv/load";
import { GoogleTtsService } from "../service/googleTts.service.ts";

async function testMultiVoice() {
  const svc = new GoogleTtsService();
  console.log("Probando multivoz con Gemini 2.5 Pro TTS...");

  const result = await svc.generateMultiVoiceAndUpload([
    {
      personaje: "Aoede",
      texto: "(gritando furiosa con desprecio) ¡Dime la verdad ahora mismo! ¿Fuiste tú quien me traicionó?",
    },
    {
      personaje: "Puck",
      texto: "(susurrando temblando de miedo) Por favor... no me hagas daño... te juro que no tuve opción...",
    },
    {
      personaje: "Aoede",
      texto: "(riendo de forma malvada y sarcástica) ¿Que no tuviste opción? ¡Ja! Ahora pagarás las consecuencias.",
    },
  ], {
    folder: "HISTORIA",
    modelName: "gemini-2.5-pro-tts"
  });

  console.log("Resultado Multivoz:");
  console.log(JSON.stringify(result, null, 2));
}

testMultiVoice();
