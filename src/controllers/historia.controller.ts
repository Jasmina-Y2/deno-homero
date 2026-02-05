import { db } from "../config/firebase.ts";
import { HistoriaData } from "../models/historia.model.ts";
import { successResponse, errorResponse } from "../utils/response.ts";

export const getHistorias = async (ctx: any) => {
    try {
        console.log("------------------------------------------------");
        console.log("📥 1. Petición recibida en /api/historias");

        if (!db) throw new Error("La conexión a Firebase (db) es nula");

        const coleccion = "HistoriaInfo";
        console.log(`🔎 2. Buscando en colección: '${coleccion}'...`);

        const snapshot = await db.collection(coleccion).get();
        console.log(`📊 3. Firebase respondió. Documentos encontrados: ${snapshot.size}`);

        if (snapshot.empty) {
            console.warn("⚠️ ¡La colección está vacía! Revisa el nombre en Firebase.");
            successResponse(ctx, [], "No hay historias (Colección vacía)");
            return;
        }

        const historias = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                const historiaId = docSnap.id;

                let comentariosCount = 0;
                try {
                    const comentariosRef = db.collection("Comentarios").doc(historiaId);
                    const comentarioSnap = await comentariosRef.get();
                    if (comentarioSnap.exists) {
                        const info = comentarioSnap.data();
                        comentariosCount = info?.comentarios?.length || 0;
                    }
                } catch (err) {
                    console.error(`❌ Error leyendo comentarios de ${historiaId}:`, err.message);
                }

                return {
                    id: historiaId,
                    ...data,
                    comentariosCount,
                };
            })
        );

        console.log("✅ 4. Enviando respuesta al navegador");
        successResponse(ctx, historias, "Historias cargadas correctamente");

    } catch (error) {
        console.error("❌ ERROR FATAL EN CONTROLADOR:");
        console.error(error);
        errorResponse(ctx, error);
    }
};

export const createHistoria = async (ctx: any) => {
    try {
        const body = ctx.request.body();
        const data: HistoriaData = await body.value;

        const docRef = await db.collection("Historia").add({
            ...data,
            fechaCreacion: new Date().toISOString(),
            vistas: 0
        });

        successResponse(ctx, { id: docRef.id }, "Historia creada correctamente");
    } catch (error) {
        errorResponse(ctx, error);
    }
};