import { db, fieldValue } from "../config/firebase.ts";
export const getUsuariosService = async () => {
    try {
        const snapshot = await db.collection("users").get();
        return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("❌ Error en getUsuariosService:", error);
        throw new Error("Error al obtener la lista de usuarios");
    }
};

export const getUsuarioByUidService = async (uid: string) => {
    try {
        const snapshot = await db.collection("users")
            .where("uid", "==", uid)
            .get();

        if (snapshot.empty) {
            console.warn(`⚠️ No se encontró usuario con UID: ${uid}`);
            return null;
        }

        const userDoc = snapshot.docs[0];
        return {
            idDoc: userDoc.id,
            ...userDoc.data()
        };
    } catch (error) {
        console.error("❌ Error en getUsuarioByUidService:", error);
        throw new Error("Error al obtener los datos del usuario");
    }
};