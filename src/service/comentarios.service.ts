import { db, fieldValue } from "../config/firebase.ts";
import { enviarPushAUsuario } from "./notification.service.ts";

// Función auxiliar para resolver el ID canónico de la historia
const resolverIdCanonicoHistoria = async (
  publicacionId: string
): Promise<{ canonicalId: string; autorUid: string | null; tituloHistoria: string }> => {
  let canonicalId = publicacionId;
  let autorUid: string | null = null;
  let tituloHistoria = "tu historia";

  try {
    // 1. Buscar por campo 'id'
    const cardSnap = await db.collection("CardHistoria").where("id", "==", publicacionId).get();
    if (!cardSnap.empty) {
      const cardData = cardSnap.docs[0].data();
      canonicalId = cardData.id || publicacionId;
      autorUid = cardData.idAutor || null;
      if (cardData.titulo) tituloHistoria = cardData.titulo;
      return { canonicalId, autorUid, tituloHistoria };
    }

    // 2. Buscar por doc ID directo
    const directCard = await db.collection("CardHistoria").doc(publicacionId).get();
    if (directCard.exists) {
      const cardData = directCard.data();
      canonicalId = cardData?.id || publicacionId;
      autorUid = cardData?.idAutor || null;
      if (cardData?.titulo) tituloHistoria = cardData.titulo;
      return { canonicalId, autorUid, tituloHistoria };
    }

    // 3. Buscar por campo 'customId'
    const customSnap = await db.collection("CardHistoria").where("customId", "==", publicacionId).get();
    if (!customSnap.empty) {
      const cardData = customSnap.docs[0].data();
      canonicalId = cardData.id || publicacionId;
      autorUid = cardData.idAutor || null;
      if (cardData.titulo) tituloHistoria = cardData.titulo;
      return { canonicalId, autorUid, tituloHistoria };
    }

    // 4. Buscar en HistoriaInfo
    const infoSnap = await db.collection("HistoriaInfo").where("id", "==", publicacionId).get();
    if (!infoSnap.empty) {
      const infoData = infoSnap.docs[0].data();
      canonicalId = infoData.id || publicacionId;
      autorUid = infoData.idAutor || null;
      if (infoData.titulo) tituloHistoria = infoData.titulo;
      return { canonicalId, autorUid, tituloHistoria };
    }
  } catch (err) {
    console.warn("⚠️ Error resolviendo ID canónico de historia:", err);
  }

  return { canonicalId, autorUid, tituloHistoria };
};

export const guardarComentarioService = async (publicacionId: string, comentario: any) => {
  try {
    const { canonicalId, autorUid } = await resolverIdCanonicoHistoria(publicacionId);

    const docRef = db.collection("Comentarios").doc(canonicalId);
    await docRef.set({
      comentarios: fieldValue.arrayUnion(comentario),
    }, { merge: true });

    // Disparar Notificación Push e Historial de Notificaciones al autor de la historia
    try {
      const idComentador = comentario?.idAutor;

      // Notificar solo si el autor existe y no es la misma persona que comenta
      if (autorUid && autorUid !== idComentador) {
        let nombreComentador = comentario?.nombre || comentario?.autor || "Un usuario";

        if (!comentario?.nombre && idComentador) {
          const userSnap = await db.collection("users").doc(idComentador).get();
          if (userSnap.exists) {
            nombreComentador = userSnap.data()?.name || "Un usuario";
          } else {
            const qUser = await db.collection("users").where("uid", "==", idComentador).get();
            if (!qUser.empty) {
              nombreComentador = qUser.docs[0].data()?.name || "Un usuario";
            }
          }
        }

        const textoComentario = comentario?.texto || comentario?.comentario || "";
        const previewTexto = textoComentario.length > 50
          ? `"${textoComentario.substring(0, 47)}..."`
          : `"${textoComentario}"`;

        const mensajePush = textoComentario
          ? `${nombreComentador} comentó: ${previewTexto}`
          : `${nombreComentador} ha dejado un comentario en tu historia.`;

        await enviarPushAUsuario(
          autorUid,
          "💬 ¡Nuevo Comentario!",
          mensajePush,
          {
            idHistoria: canonicalId,
            tipo: "comentario",
            idComentador: idComentador || "",
            nombreComentador: nombreComentador,
            textoComentario: textoComentario,
          },
        );
      }
    } catch (pushErr) {
      console.warn("⚠️ No se pudo enviar notificación de comentario:", pushErr);
    }

    return { success: true, message: "Comentario guardado correctamente" };
  } catch (error) {
    console.error("❌ Error en guardarComentarioService:", error);
    throw new Error("Error al procesar el comentario en la base de datos");
  }
};

export const obtenerComentariosService = async (publicacionId: string) => {
  try {
    const { canonicalId } = await resolverIdCanonicoHistoria(publicacionId);

    const docSnap = await db.collection("Comentarios").doc(canonicalId).get();

    if (!docSnap.exists) {
      if (canonicalId !== publicacionId) {
        const origSnap = await db.collection("Comentarios").doc(publicacionId).get();
        if (origSnap.exists) return origSnap.data()?.comentarios || [];
      }
      return [];
    }

    return docSnap.data()?.comentarios || [];
  } catch (error) {
    console.error("❌ Error en obtenerComentariosService:", error);
    return [];
  }
};