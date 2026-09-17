import { db } from "../config/firebase.ts";
import { HistoriaData, HistoriaDocument } from "../models/historia.model.ts";


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

export const getHistoriaByCustomIdService = async (
    customId: string
): Promise<HistoriaDocument[]> => {
    try {
        const querySnapshot = await db
            .collection("Historia")
            .where("id", "==", customId)
            .get();

        const result: HistoriaDocument[] = [];

        querySnapshot.forEach((doc) => {
            result.push({
                ...(doc.data() as HistoriaDocument),
                idDoc: doc.id,
            });
        });

        if (result.length === 0) {
            const docSnap = await db.collection("Historia").doc(customId).get();
            if (docSnap.exists) {
                result.push({
                    ...(docSnap.data() as HistoriaDocument),
                    idDoc: docSnap.id,
                    id: (docSnap.data() as any)?.id || docSnap.id,
                });
            }
        }

        return result;
    } catch (error) {
        console.error("❌ Error al obtener documento de Historia:", error);
        throw new Error("Error al obtener información de la historia");
    }
};