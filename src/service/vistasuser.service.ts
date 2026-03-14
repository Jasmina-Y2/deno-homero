import { db, fieldValue } from "../config/firebase.ts";

export const registrarVistaUsuarioService = async (idUsuario: string, idHistoria: string) => {
    try {
        const vistasRef = db.collection("Vistasuser").doc(idUsuario);
        await vistasRef.set({
            vistas: fieldValue.arrayUnion(idHistoria)
        }, { merge: true });

        console.log(`✅ Vista registrada para usuario ${idUsuario} en historia ${idHistoria}`);
        return true;
    } catch (error) {
        console.error(`❌ Error en registrarVistaUsuarioService:`, error);
        throw error;
    }
};
export const verificarHistoriaVistaService = async (idUsuario: string, idHistoria: string) => {
    try {
        if (!idUsuario || !idHistoria) return false;

        const vistasSnap = await db.collection("Vistasuser").doc(idUsuario).get();

        if (vistasSnap.exists) {
            const listaVistas: string[] = vistasSnap.data()?.vistas || [];
            return listaVistas.includes(idHistoria);
        }
        return false;
    } catch (error) {
        console.error("❌ Error en verificarHistoriaVistaService:", error);
        return false;
    }
};

export const getHistoriasVistasService = async (idUsuario: string) => {
    try {
        const vistasSnap = await db.collection("Vistasuser").doc(idUsuario).get();

        if (!vistasSnap.exists) return [];

        const idsVistos: string[] = vistasSnap.data()?.vistas || [];
        if (idsVistos.length === 0) return [];

        const qSnap = await db.collection("CardHistoria")
            .where("id", "in", idsVistos.slice(0, 30))
            .get();

        return qSnap.docs.map((doc) => ({
            idDoc: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error("❌ Error en getHistoriasVistasService:", error);
        throw new Error("Error al obtener historial de vistas");
    }
};