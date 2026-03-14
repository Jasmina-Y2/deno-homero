import { db } from "../config/firebase.ts";



export const guardarAudioService = async (historiaUID: string, index: number, url: string, idioma: "es" | "en") => {
    try {
        const historiaRef = db.collection("AudioHistoria").doc(historiaUID);
        const campo = idioma === "en" ? "AudioEN" : "AudioES";

        const docSnap = await historiaRef.get();

        let data = docSnap.exists ? docSnap.data() : { AudioES: [], AudioEN: [] };
        if (!data) data = { AudioES: [], AudioEN: [] };

        let arrayActual: string[] = data[campo] || [];

        while (arrayActual.length <= index) {
            arrayActual.push("");
        }

        arrayActual[index] = url;

        await historiaRef.set({ [campo]: arrayActual }, { merge: true });

        return arrayActual;
    } catch (error) {
        console.error(`❌ Error en guardarAudioService (ID: ${historiaUID}):`, error);
        throw error;
    }
};
export const obtenerAudiosHistoriaService = async (historiaUID: string) => {
    try {
        const docSnap = await db.collection("AudioHistoria").doc(historiaUID).get();

        if (!docSnap.exists) {
            const emptyData = { AudioES: [], AudioEN: [] };
            await db.collection("AudioHistoria").doc(historiaUID).set(emptyData);
            return emptyData;
        }

        return docSnap.data();
    } catch (error) {
        console.error(`❌ Error en obtenerAudiosHistoriaService (ID: ${historiaUID}):`, error);
        throw error;
    }
};