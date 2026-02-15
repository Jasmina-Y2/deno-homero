import { db } from "../config/firebase.ts";
import { CardHistoria } from "../models/cardhistoria.model.ts";

export const guardarCardHistoriaEnFirestoreService = async (data: CardHistoria): Promise<string> => {
    try {
        const docRef = await db.collection("CardHistoria").add(data);
        console.log("✅ CARD guardada. ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("❌ Error guardando Card:", error);
        throw new Error("Error al guardar la Card");
    }
};

export const obtenerCardHistoriaService = async (): Promise<CardHistoria[]> => {
    try {
        const snapshot = await db.collection("CardHistoria")
            .orderBy("fecha", "desc")
            .get();
        if (snapshot.empty) {
            console.log("⚠️ La colección CardHistoria está vacía.");
            return [];
        }

        const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
        })) as CardHistoria[];

        console.log(`✅ Se obtuvieron ${data.length} historias correctamente.`);
        return data;

    } catch (error) {
        console.error("❌ Error obteniendo historias:", error);
        throw new Error("Error al obtener la lista de historias");
    }
};