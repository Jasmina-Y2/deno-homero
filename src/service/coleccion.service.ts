import { db } from "../config/firebase.ts";

export const crearColeccionService = async (data: any): Promise<string> => {
    try {
        const docRef = await db.collection("Coleccion").add({
            ...data,
            fechaCreacion: new Date().toISOString()
        });
        await db.collection("ColeccionIds").doc(data.uid).set({
            historias: [],
            creadoEn: new Date().toISOString(),
        });

        console.log("✅ Colección e Historial de IDs creados con éxito");
        return docRef.id;

    } catch (error) {
        console.error("❌ Error al crear la colección en el backend:", error);
        throw new Error("No se pudo procesar la creación de la colección");
    }
};

export const mostrarColeccionesPorAutorService = async (idAutor: string) => {
    if (!idAutor) throw new Error("Se requiere el idAutor");

    try {
        const querySnapshot = await db.collection("Coleccion")
            .where("idAutor", "==", idAutor)
            .get();

        if (querySnapshot.empty) return [];

        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error(`❌ Error buscando colecciones del autor ${idAutor}:`, error);
        throw new Error("Error al buscar colecciones del autor");
    }
};

export const getColeccionesPorIdService = async (uid: string) => {
    try {
        const snapshot = await db.collection("Coleccion")
            .where("uid", "==", uid)
            .get();

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error("❌ Error en getColeccionesPorIdService:", error);
        throw new Error("Error al obtener las colecciones del usuario");
    }
};


