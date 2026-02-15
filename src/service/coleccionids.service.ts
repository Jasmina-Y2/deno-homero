import { db } from "../config/firebase.ts";
import { FieldValue } from "npm:firebase-admin/firestore";

export const agregarHistoriaAColeccionService = async (
    coleccionId: string,
    historiaId: string
): Promise<string> => {
    if (!coleccionId) return "";

    try {
        const coleccionRef = db.collection("ColeccionIds").doc(coleccionId);
        await coleccionRef.set(
            {
                historias: FieldValue.arrayUnion(historiaId),
            },
            { merge: true }
        );

        return coleccionRef.id;

    } catch (error) {
        console.error(`❌ Error al agregar la historia a ColeccionIds/${coleccionId}:`, error);
        throw new Error("Fallo en la operación de base de datos");
    }
};