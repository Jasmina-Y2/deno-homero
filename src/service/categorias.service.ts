import { db } from "../config/firebase.ts";

export const getCategoriasService = async () => {
    try {
        const snapshot = await db.collection("Categorias").get();

        if (snapshot.empty) {
            return [];
        }

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));

    } catch (error) {
        console.error(error);
        throw error;
    }
};