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

/**
 * Reordena los episodios de una colección:
 * 1. Actualiza el array `historias` en `ColeccionIds/{idColeccion}` con el nuevo orden.
 * 2. Actualiza el campo `Coleccion.episodio` y `episodio` en `CardHistoria`, `HistoriaInfo` y `Historia`
 *    asignando a cada historia su nuevo número de episodio (1, 2, 3...).
 */
export const reordenarEpisodiosColeccionService = async (
    idColeccion: string,
    historiasInput: any
) => {
    if (!idColeccion) {
        throw new Error("Se requiere 'idColeccion' o 'uid' de la colección.");
    }

    // Normalizar historias en un array de strings (IDs ordenados)
    let historiasOrdenadas: string[] = [];

    if (Array.isArray(historiasInput)) {
        historiasOrdenadas = historiasInput.map((item: any) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
                return (item.id || item.idHistoria || item.idDoc || "").trim();
            }
            return String(item).trim();
        }).filter((id: string) => id.length > 0);
    }

    if (historiasOrdenadas.length === 0) {
        throw new Error("El arreglo de 'historias' no puede estar vacío y debe contener IDs válidos.");
    }

    try {
        // 1. Localizar el documento en ColeccionIds
        let targetDocRef = db.collection("ColeccionIds").doc(idColeccion);
        const docSnap = await targetDocRef.get();

        if (!docSnap.exists) {
            const querySnap = await db.collection("ColeccionIds").where("uid", "==", idColeccion).get();
            if (!querySnap.empty) {
                targetDocRef = querySnap.docs[0].ref;
            }
        }

        const batch = db.batch();

        // 2. Actualizar el array 'historias' en ColeccionIds con el nuevo orden
        batch.set(
            targetDocRef,
            {
                historias: historiasOrdenadas,
                actualizadoEn: new Date().toISOString(),
            },
            { merge: true }
        );

        // 3. Actualizar el número de episodio en CardHistoria, HistoriaInfo e Historia
        const colecciones = ["CardHistoria", "HistoriaInfo", "Historia"];

        for (let index = 0; index < historiasOrdenadas.length; index++) {
            const idHistoria = historiasOrdenadas[index];
            const nuevoEpisodio = index + 1; // 1-based (Episodio 1, Episodio 2, Episodio 3...)

            for (const colName of colecciones) {
                const querySnap = await db.collection(colName)
                    .where("id", "==", idHistoria)
                    .get();

                for (const doc of querySnap.docs) {
                    const data = doc.data();
                    const updates: Record<string, any> = {
                        episodio: nuevoEpisodio,
                        actualizadoEn: new Date().toISOString(),
                    };

                    if (data.Coleccion && typeof data.Coleccion === "object") {
                        updates["Coleccion"] = {
                            ...data.Coleccion,
                            episodio: nuevoEpisodio,
                        };
                    }
                    if (data.COLECCION && typeof data.COLECCION === "object") {
                        updates["COLECCION"] = {
                            ...data.COLECCION,
                            episodio: nuevoEpisodio,
                        };
                    }
                    if (data.coleccion && typeof data.coleccion === "object") {
                        updates["coleccion"] = {
                            ...data.coleccion,
                            episodio: nuevoEpisodio,
                        };
                    }

                    batch.update(doc.ref, updates);
                }
            }
        }

        await batch.commit();
        console.log(`✅ Orden de episodios actualizado con éxito para la colección: ${idColeccion}`);

        return {
            idColeccion,
            totalEpisodios: historiasOrdenadas.length,
            historias: historiasOrdenadas,
            mensaje: "Orden de episodios actualizado con éxito."
        };
    } catch (error) {
        console.error(`❌ Error al reordenar episodios en ColeccionIds/${idColeccion}:`, error);
        throw new Error(error instanceof Error ? error.message : "Error al reordenar episodios en la base de datos");
    }
};