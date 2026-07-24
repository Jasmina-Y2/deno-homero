import { db } from "../config/firebase.ts";
import { FieldValue } from "npm:firebase-admin/firestore";

export const agregarHistoriaAColeccionService = async (
    idColeccion: string,
    idHistoria: string
): Promise<string> => {
    if (!idColeccion || !idHistoria) return "Error: idColeccion o idHistoria no proporcionados";

    try {
        const coleccionRef = db.collection("ColeccionIds").doc(idColeccion);
        await coleccionRef.set(
            {
                historias: FieldValue.arrayUnion(idHistoria),
            },
            { merge: true }
        );
        console.log("✅ Historia agregada a la colección", coleccionRef);

        return coleccionRef.id;

    } catch (error) {
        console.error(`❌ Error al agregar la historia a ColeccionIds/${idColeccion}:`, error);
        throw new Error("Fallo en la operación de base de datos");
    }
};

export const getColeccionPorNombreService = async (docId: string) => {
    try {
        const docSnap = await db.collection("ColeccionIds").doc(docId).get();

        if (!docSnap.exists) return [];

        const data = docSnap.data();
        const historiasIds: string[] = Array.isArray(data?.historias)
            ? data.historias.filter((id: string) => id !== undefined && id !== null)
            : [];

        if (historiasIds.length === 0) return [];

        const historiasCompletas = await Promise.all(
            historiasIds.map(async (id) => {
                const historiaSnap = await db.collection("HistoriaInfo")
                    .where("id", "==", id)
                    .get();

                if (!historiaSnap.empty) {
                    return { idDoc: historiaSnap.docs[0].id, ...historiaSnap.docs[0].data() };
                }
                return null;
            })
        );

        return historiasCompletas.filter((h) => h !== null);
    } catch (error) {
        console.error("❌ Error en getColeccionPorNombreService:", error);
        throw new Error("Error al obtener la colección detallada");
    }
};