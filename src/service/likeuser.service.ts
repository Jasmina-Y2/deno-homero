import { db, fieldValue } from "../config/firebase.ts";
import { actualizarLikesHelper } from "./historiaInfo.service.ts";
import { enviarPushAUsuario } from "./notification.service.ts";

export interface LikeExtraData {
  idAutorHistoria?: string;
  usuarioQueDaLike?: { uid?: string; name?: string } | string;
  nombreUsuario?: string;
}

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

export const toggleLikeService = async (
    idPublicacion: string,
    idUsuario: string,
    extraData?: LikeExtraData,
) => {
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

            // Disparar Notificación Push al autor
            try {
                let autorUid = extraData?.idAutorHistoria;
                let storyTitle = "tu historia";

                if (!autorUid) {
                    const cardSnap = await db.collection("CardHistoria").where("id", "==", idPublicacion).get();
                    if (!cardSnap.empty) {
                        const cardData = cardSnap.docs[0].data();
                        autorUid = cardData.idAutor;
                        if (cardData.titulo) storyTitle = cardData.titulo;
                    } else {
                        const directCard = await db.collection("CardHistoria").doc(idPublicacion).get();
                        if (directCard.exists) {
                            const cardData = directCard.data();
                            autorUid = cardData?.idAutor;
                            if (cardData?.titulo) storyTitle = cardData.titulo;
                        }
                    }
                }

                // Notificar si no es su propia historia
                if (autorUid && autorUid !== idUsuario) {
                    let nombreLiker = "Alguien";
                    if (extraData?.nombreUsuario) {
                        nombreLiker = extraData.nombreUsuario;
                    } else if (typeof extraData?.usuarioQueDaLike === "object" && extraData.usuarioQueDaLike?.name) {
                        nombreLiker = extraData.usuarioQueDaLike.name;
                    } else {
                        const userSnap = await db.collection("users").doc(idUsuario).get();
                        if (userSnap.exists) {
                            nombreLiker = userSnap.data()?.name || "Un usuario";
                        } else {
                            const qUser = await db.collection("users").where("uid", "==", idUsuario).get();
                            if (!qUser.empty) {
                                nombreLiker = qUser.docs[0].data()?.name || "Un usuario";
                            }
                        }
                    }

                    await enviarPushAUsuario(
                        autorUid,
                        "❤️ ¡Nuevo Me Gusta!",
                        `A ${nombreLiker} le gustó tu historia.`,
                        { idHistoria: idPublicacion, tipo: "like" },
                    );
                }
            } catch (pushErr) {
                console.warn("⚠️ No se pudo enviar push de like:", pushErr);
            }
        }
        return { like: isLiked, total: nuevoTotal };

    } catch (error) {
        console.error(`❌ Error en toggleLikeService:`, error);
        throw error;
    }
};

export const guardarLikeHistoriaService = async (
    idHistoria: string,
    idAutorHistoria?: string,
    usuarioQueDaLike?: { uid?: string; name?: string } | string,
) => {
    const uid = typeof usuarioQueDaLike === "object" ? usuarioQueDaLike?.uid : usuarioQueDaLike;
    const nombre = typeof usuarioQueDaLike === "object" ? usuarioQueDaLike?.name : undefined;

    if (!uid) {
        throw new Error("UID de usuario requerido para dar like");
    }

    return await toggleLikeService(idHistoria, uid, {
        idAutorHistoria,
        usuarioQueDaLike,
        nombreUsuario: nombre,
    });
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