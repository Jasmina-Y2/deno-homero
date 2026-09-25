import "jsr:@std/dotenv/load";
import { GoogleAuth } from "npm:google-auth-library";

async function testVertex() {
  const auth = new GoogleAuth({
    keyFilename: "./clave.json",
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();

  const promptTexto = `Read the following text according to these style instructions:
Style instructions: Read in a furious, aggressive and loud tone, screaming with intense anger.

Text to speak:
¡No me pidas que me calme! ¿Tienes idea de lo que has hecho? Confié en ti, te di absolutamente todo... ¡y lo arruinaste por completo! No quiero escuchar tus excusas. ¡Lárgate! ¡No quiero volver a verte en mi vida!`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptTexto }]
      }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Aoede"
          }
        }
      }
    }
  };

  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/ciarv-2dfcc/locations/us-central1/publishers/google/models/gemini-2.5-flash-preview-tts:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenRes.token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Respuesta Vertex Direct:", JSON.stringify(data, null, 2).substring(0, 500));
}

testVertex();
