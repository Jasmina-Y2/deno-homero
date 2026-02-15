import { db } from "../config/firebase.ts";
import { HistoriaData } from "../models/historia.model.ts";


export const guardarHistoriaEnFirestoreService = async (data: HistoriaData): Promise<string> => {
    try {
        const docRef = await db.collection("Historia").add(data);
        console.log("✅ Contenido Historia guardado. ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("❌ Error guardando contenido historia:", error);
        throw new Error("Error al guardar el contenido de la historia");
    }
};
