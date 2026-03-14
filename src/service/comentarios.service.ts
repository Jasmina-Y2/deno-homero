import { db, fieldValue } from "../config/firebase.ts";


export const guardarComentarioService = async (publicacionId: string, comentario: any) => {
    try {
        const docRef = db.collection("Comentarios").doc(publicacionId);
        await docRef.set({
            comentarios: fieldValue.arrayUnion(comentario)
        }, { merge: true });

        return { success: true, message: "Comentario guardado correctamente" };
    } catch (error) {
        console.error("❌ Error en guardarComentarioService:", error);
        throw new Error("Error al procesar el comentario en la base de datos");
    }
};

export const obtenerComentariosService = async (publicacionId: string) => {
    try {
        const docSnap = await db.collection("Comentarios").doc(publicacionId).get();

        if (!docSnap.exists) return [];

        return docSnap.data()?.comentarios || [];
    } catch (error) {
        console.error("❌ Error en obtenerComentariosService:", error);
        return [];
    }
};