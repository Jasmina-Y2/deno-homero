import { db } from "../config/firebase.ts";

export const getHistoriasFromCategoriaService = async (categoriaId: string) => {
    try {
        const catSnap = await db.collection("CategoriaHistoria").doc(categoriaId).get();

        if (!catSnap.exists) return [];

        const data = catSnap.data();
        const historiasIds: string[] = data?.historias || [];

        if (historiasIds.length === 0) return [];

        const historiasPromesas = historiasIds.map(async (hid) => {
            const qSnap = await db.collection("CardHistoria")
                .where("id", "==", hid)
                .get();

            if (!qSnap.empty) {
                const doc = qSnap.docs[0];
                return {
                    idFirestore: doc.id,
                    ...doc.data()
                };
            }
            return null;
        });

        const resultados = await Promise.all(historiasPromesas);

        return resultados.filter(h => h !== null);

    } catch (error) {
        console.error(`❌ Error en getHistoriasFromCategoriaService (${categoriaId}):`, error);
        throw new Error("No se pudieron cargar las historias de esta categoría");
    }
};