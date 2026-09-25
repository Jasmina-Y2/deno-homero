import "jsr:@std/dotenv/load";
import { GoogleAuth } from "npm:google-auth-library";

async function test() {
  const auth = new GoogleAuth({
    keyFilename: "./clave.json",
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  console.log("Token obtenido correctamente.");

  const payload = {
    audioConfig: {
      audioEncoding: "MP3",
      pitch: 0,
      speakingRate: 1,
    },
    input: {
      prompt: "furious, aggressive and loud tone, screaming with intense rage",
      text: "¡No me pidas que me calme! ¿Tienes idea de lo que has hecho? Confié en ti, te di absolutamente todo... ¡y lo arruinaste por completo! No quiero escuchar tus excusas. ¡Lárgate! ¡No quiero volver a verte en mi vida!",
    },
    voice: {
      languageCode: "es-MX",
      modelName: "gemini-2.5-pro-tts",
      name: "Aoede",
    },
  };

  const res = await fetch("https://texttospeech.googleapis.com/v1beta1/text:synthesize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenRes.token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Respuesta Text-to-Speech v1beta1:", JSON.stringify(data, null, 2).substring(0, 500));
}

test();
