import { db } from "../config/firebase.ts";
import { HistoriaInfo } from "../models/historiainfo.model.ts";

export const guardarHistoriaInfoEnFirestoreService = async (data: HistoriaInfo): Promise<string> => {
    try {
        const docRef = await db.collection("HistoriaInfo").add(data);
        console.log("✅ Info Historia guardada. ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("❌ Error guardando info historia:", error);
        throw new Error("Error al guardar información de la historia");
    }
};