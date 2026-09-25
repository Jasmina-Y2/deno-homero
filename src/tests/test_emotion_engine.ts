import { googleTtsService } from "../service/googleTts.service.ts";

const historiaConEmociones = [
  {
    personaje: "Aoede",
    texto: "(gritando) ¡No, no! ¡Por favor no abras esa puerta!"
  },
  {
    personaje: "Aoede",
    texto: "(susurrando) No hagas ruido... escucho su respiración detrás de la pared..."
  },
  {
    personaje: "Aoede",
    texto: "(llorando) Por favor ayúdame... tengo tanto miedo que no puedo respirar..."
  },
  {
    personaje: "Puck",
    texto: "(riendo) ¡Jajajaja! ¡Tranquila! ¡Que era yo haciéndote una broma! ¡Jajajajaja!"
  },
  {
    personaje: "Charon",
    texto: "(con misterio) Pero lo que Puck no sabía... es que la verdadera sombra estaba parada detrás de él."
  }
];

const res = await googleTtsService.generateMultiVoiceAndUpload(historiaConEmociones, "HISTORIA", "historia_emociones_vivas");
console.log("Audio de emociones generado exitosamente!");
console.log("URL S3:", res.url);
