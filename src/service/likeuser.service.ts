import { db, fieldValue } from "../config/firebase.ts";
import { actualizarLikesHelper } from "./historiaInfo.service.ts";
export const checkIfLikedService = async (idPublicacion: string, idUsuario: string): Promise<boolean> => {
    try {
        const docRef = db.collection("likesUsuarios").doc(idPublicacion);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            return data?.usuarios?.includes(idUsuario) || false;
        }

        return false;
    } catch (error) {
        console.error("❌ Error en checkIfLikedService:", error);
        return false;
    }
};

export const toggleLikeService = async (idPublicacion: string, idUsuario: string) => {
    try {
        const likeRef = db.collection("likesUsuarios").doc(idPublicacion);
        const userLikeRef = db.collection("Likeuser").doc(idUsuario);

        const likeSnap = await likeRef.get();
        const data = likeSnap.data();
        const usuarios: string[] = data?.usuarios || [];

        let isLiked = false;
        let nuevoTotal = usuarios.length;

        if (usuarios.includes(idUsuario)) {
            await likeRef.update({ usuarios: fieldValue.arrayRemove(idUsuario) });
            await actualizarLikesHelper(idPublicacion, "restar");

            await userLikeRef.set({ likes: fieldValue.arrayRemove(idPublicacion) }, { merge: true });

            isLiked = false;
            nuevoTotal = Math.max(0, usuarios.length - 1);
        } else {
            await likeRef.set({ usuarios: fieldValue.arrayUnion(idUsuario) }, { merge: true });
            await actualizarLikesHelper(idPublicacion, "sumar");

            await userLikeRef.set({ likes: fieldValue.arrayUnion(idPublicacion) }, { merge: true });

            isLiked = true;
            nuevoTotal = usuarios.length + 1;
        }
        return { like: isLiked, total: nuevoTotal };

    } catch (error) {
        console.error(`❌ Error en toggleLikeService:`, error);
        throw error;
    }
};
export const obtenerTotalLikesService = async (idPublicacion: string) => {
    try {
        const likeSnap = await db.collection("likesUsuarios").doc(idPublicacion).get();

        if (likeSnap.exists) {
            const usuarios = likeSnap.data()?.usuarios || [];
            return usuarios.length;
        }
        return 0;
    } catch (error) {
        console.error("❌ Error en obtenerTotalLikesService:", error);
        throw new Error("No se pudo obtener el conteo de likes");
    }
};

//nuevo
export const getHistoriasConLikeService = async (idUsuario: string) => {
    try {
        const userLikeSnap = await db.collection("Likeuser").doc(idUsuario).get();

        if (!userLikeSnap.exists) return [];

        const likesArray: string[] = userLikeSnap.data()?.likes || [];
        if (likesArray.length === 0) return [];

        const historias: any[] = [];
        const batchSize = 10;

        for (let i = 0; i < likesArray.length; i += batchSize) {
            const batch = likesArray.slice(i, i + batchSize);

            const qSnap = await db.collection("CardHistoria")
                .where("id", "in", batch)
                .get();

            qSnap.forEach((doc) => {
                historias.push({ idDoc: doc.id, ...doc.data() });
            });
        }

        return historias;
    } catch (error) {
        console.error("❌ Error en getHistoriasConLikeService:", error);
        throw new Error("Error al obtener favoritos");
    }
};