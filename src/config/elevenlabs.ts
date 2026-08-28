export interface ElevenLabsVoice {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
  description: string;
}

export const SPANISH_VOICES: ElevenLabsVoice[] = [
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda",
    gender: "female",
    description: "Conocedora, profesional",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    gender: "female",
    description: "Madura, tranquilizadora, segura",
  },
  {
    id: "FGY2WhTYpPnrIDTdsKH5",
    name: "Laura",
    gender: "female",
    description: "Entusiasta, peculiar",
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice",
    gender: "female",
    description: "Educadora clara y atractiva",
  },
  {
    id: "hpp4J3VqNfWAUOO0d1Us",
    name: "Bella",
    gender: "female",
    description: "Profesional, brillante, cálida",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica",
    gender: "female",
    description: "Juguetona, brillante",
  },
  {
    id: "pFZP5JQG7iQjIQuC4Bku",
    name: "Lily",
    gender: "female",
    description: "Actriz con voz aterciopelada",
  },

  // 👨 VOCES MASCULINAS / NEUTRALES
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    gender: "male",
    description: "Dominante, firme",
  },
  {
    id: "CwhRBWXzGAHq8TQ4Fs17",
    name: "Roger",
    gender: "male",
    description: "Relajado, casual, resonante",
  },
  {
    id: "IKne3meq5aSn9XLyUdCD",
    name: "Charlie",
    gender: "male",
    description: "Profundo, seguro, enérgico",
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    gender: "male",
    description: "Narrador cálido y cautivador",
  },
  {
    id: "N2lVS1w4EtoT3dr4eOWO",
    name: "Callum",
    gender: "male",
    description: "Embaucador ronco",
  },
  {
    id: "SAz9YHcvj6GT2YYXdXww",
    name: "River",
    gender: "neutral",
    description: "Relajado, neutral, informativo",
  },
  {
    id: "SOYHLrjzK2X1ezoPC6cr",
    name: "Harry",
    gender: "male",
    description: "Guerrero feroz",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    name: "Liam",
    gender: "male",
    description: "Creador de redes sociales enérgico",
  },
  {
    id: "bIHbv24MWmeRgasZH58o",
    name: "Will",
    gender: "male",
    description: "Optimista relajado",
  },
  {
    id: "cjVigY5qzO86Huf0OWal",
    name: "Eric",
    gender: "male",
    description: "Suave, confiable",
  },
  {
    id: "iP95p4xoKVk53GoZ742B",
    name: "Chris",
    gender: "male",
    description: "Encantador, con los pies en la tierra",
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian",
    gender: "male",
    description: "Profundo, resonante y reconfortante",
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    gender: "male",
    description: "Locutor constante",
  },
];

export const config = {
  elevenLabs: {
    defaultVoiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah
    modelId: "eleven_multilingual_v2",
  },
  server: {
    port: Number(Deno.env.get("PORT")) || 8000,
  },
};
