import "jsr:@std/dotenv/load";
import lamejs from "npm:@breezystack/lamejs";

function pcmToMp3(pcmBytes: Uint8Array, sampleRate = 24000, numChannels = 1, kbps = 128): Uint8Array {
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);
  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Chunks: Uint8Array[] = [];

  const sampleBlockSize = 1152;
  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(endBuf));
  }

  const totalLength = mp3Chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

const apiKey = Deno.env.get("GEMINI_API_KEY")?.replace(/["']/g, "").trim();
console.log("Usando GEMINI_API_KEY:", apiKey?.substring(0, 10) + "...");

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

const models = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-3.1-flash-tts-preview"
];

for (const model of models) {
  try {
    console.log(`Probando modelo ${model} con Google AI Studio API Key...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) {
      console.log(`Error en ${model}:`, data.error.message || data.error);
    } else {
      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) {
        console.log(`🎉 ¡ÉXITO TOTAL en ${model}! Base64 len:`, inlineData.data.length);
        const binaryString = atob(inlineData.data);
        const pcmBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pcmBytes[i] = binaryString.charCodeAt(i);
        }
        const mp3 = pcmToMp3(pcmBytes, 24000, 1, 128);
        await Deno.writeFile("./src/tests/test_gemini25_furia.mp3", mp3);
        console.log("Archivo MP3 guardado en ./src/tests/test_gemini25_furia.mp3 (Bytes:", mp3.length, ")");
        break;
      }
    }
  } catch (e: any) {
    console.log(`Excepción en ${model}:`, e.message);
  }
}
