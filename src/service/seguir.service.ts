import { db } from "../config/firebase.ts";

export const getGenteQueMeSigueService = async (uid: string) => {
    try {
        const docSnap = await db.collection("Seguir").doc(uid).get();
        return docSnap.exists ? docSnap.data()?.seguidores || [] : [];
    } catch (error) {
        console.error("❌ Error en getGenteQueMeSigueService:", error);
        return [];
    }
};