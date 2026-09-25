import "jsr:@std/dotenv/load";

const apiKey = Deno.env.get("GEMINI_API_KEY")?.replace(/["']/g, "").trim();

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
const res = await fetch(url);
const data = await res.json();

console.log("Total modelos disponibles con esta API Key:", data.models?.length);
const modelsWithAudio = data.models?.filter((m: any) => 
  m.supportedGenerationMethods?.includes("generateContent") && 
  (m.name?.includes("flash") || m.name?.includes("pro") || m.name?.includes("tts"))
);

console.log("Modelos candidatos:", JSON.stringify(modelsWithAudio?.map((m: any) => ({
  name: m.name,
  displayName: m.displayName,
  description: m.description
})), null, 2));
