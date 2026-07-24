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

        return querySnapshot.docs.map((doc:any) => ({
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

        return snapshot.docs.map((doc:any) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error("❌ Error en getColeccionesPorIdService:", error);
        throw new Error("Error al obtener las colecciones del usuario");
    }
};
export const eliminarColeccionesPorUidService = async (uid: string) => {
    try {
        const snapshot = await db.collection("Coleccion")
            .where("uid", "==", uid)
            .get();
        if (snapshot.empty) {
            return { message: "No se encontraron colecciones para este usuario." };
        }
        const deletePromises = snapshot.docs.map((doc:any) => doc.ref.delete());
        await Promise.all(deletePromises);

        return { message: "Colecciones eliminadas exitosamente." };
    } catch (error) {
        console.error("❌ Error en eliminarColeccionesPorUidService:", error);
        throw new Error("Error al eliminar las colecciones del usuario");
    }
};

export const getTodasLasColeccionesService = async () => {
    try {
        const snapshot = await db.collection("Coleccion").get();

        return snapshot.docs.map((doc:any) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error("❌ Error en getTodasLasColeccionesService:", error);
        throw new Error("Error al obtener todas las colecciones");
    }
};
