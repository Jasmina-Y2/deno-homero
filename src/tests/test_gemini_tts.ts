import "jsr:@std/dotenv/load";

const apiKey = Deno.env.get("GEMINI_API_KEY")?.replace(/["']/g, "").trim();

const testModels = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
];

for (const model of testModels) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: "Grita con terror y luego lloriquea desesperada: ¡Nooo! ¡Por favor no entres ahí! (sollozando) Tengo mucho miedo..." }]
        }],
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
      })
    });
    const data = await res.json();
    if (data.error) {
      console.log(`Model ${model} error:`, data.error.message);
    } else {
      const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      console.log(`Model ${model} SUCCESS! Base64 length:`, audioData?.data?.length, "mimeType:", audioData?.mimeType);
    }
  } catch (e: any) {
    console.log(`Model ${model} failed:`, e.message);
  }
}
