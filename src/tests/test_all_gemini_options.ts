import { GoogleAuth } from "npm:google-auth-library";

const auth = new GoogleAuth({
  keyFilename: "./clave.json",
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});

const client = await auth.getClient();
const token = await client.getAccessToken();

console.log("Token obtenido con clave.json:", Boolean(token.token));

// 1. Probar endpoints regionales de Text-to-Speech v1beta1
const regions = ["us-central1", "global", "us-east1", "europe-west4"];
const ttsModels = ["gemini-2.5-pro-tts", "gemini-2.5-flash-tts"];

for (const region of regions) {
  for (const model of ttsModels) {
    const host = region === "global" ? "texttospeech.googleapis.com" : `${region}-texttospeech.googleapis.com`;
    const url = `https://${host}/v1beta1/text:synthesize`;
    
    const payload = {
      audioConfig: { audioEncoding: "MP3", speakingRate: 1 },
      input: {
        prompt: "Read in a furious, aggressive and loud tone, screaming with intense anger.",
        text: "¡No me pidas que me calme! ¿Tienes idea de lo que has hecho? Confié en ti, te di absolutamente todo... ¡y lo arruinaste por completo! No quiero escuchar tus excusas. ¡Lárgate! ¡No quiero volver a verte en mi vida!"
      },
      voice: {
        languageCode: "es-MX",
        modelName: model,
        name: "Aoede"
      }
    };

    try {
      console.log(`[TTS ${region}] Probando ${model}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.audioContent) {
        console.log(`🎉🎉🎉 ¡ÉXITO ROTUNDO con ${model} en ${region}! Audio recibido: ${data.audioContent.length} bytes`);
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        await Deno.writeFile("./src/tests/test_GEMINI_PRO_REAL.mp3", bytes);
        console.log("GUARDADO EN ./src/tests/test_GEMINI_PRO_REAL.mp3");
        Deno.exit(0);
      } else {
        console.log(`[TTS ${region}] ${model}:`, data.error?.message?.substring(0, 100));
      }
    } catch (e: any) {
      console.log(`[TTS ${region}] Error:`, e.message);
    }
  }
}
