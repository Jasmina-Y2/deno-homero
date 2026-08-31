import { db, fieldValue } from "../config/firebase.ts";
import { enviarPushAUsuario } from "./notification.service.ts";

export const guardarComentarioService = async (publicacionId: string, comentario: any) => {
  try {
    const docRef = db.collection("Comentarios").doc(publicacionId);
    await docRef.set({
      comentarios: fieldValue.arrayUnion(comentario),
    }, { merge: true });

    // Disparar Notificación Push e Historial de Notificaciones al autor de la historia
    try {
      const idComentador = comentario?.idAutor;
      let autorUid: string | null = null;
      let tituloHistoria = "tu historia";

      // 1. Buscar el autor de la historia en CardHistoria
      const cardSnap = await db.collection("CardHistoria").where("id", "==", publicacionId).get();
      if (!cardSnap.empty) {
        const cardData = cardSnap.docs[0].data();
        autorUid = cardData.idAutor;
        if (cardData.titulo) tituloHistoria = cardData.titulo;
      } else {
        const directCard = await db.collection("CardHistoria").doc(publicacionId).get();
        if (directCard.exists) {
          const cardData = directCard.data();
          autorUid = cardData?.idAutor;
          if (cardData?.titulo) tituloHistoria = cardData.titulo;
        } else {
          // Buscar en HistoriaInfo por si acaso
          const infoSnap = await db.collection("HistoriaInfo").where("id", "==", publicacionId).get();
          if (!infoSnap.empty) {
            const infoData = infoSnap.docs[0].data();
            autorUid = infoData.idAutor;
            if (infoData.titulo) tituloHistoria = infoData.titulo;
          }
        }
      }

      // 2. Notificar solo si el autor existe y no es la misma persona que comenta
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
            idHistoria: publicacionId,
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
    const docSnap = await db.collection("Comentarios").doc(publicacionId).get();

    if (!docSnap.exists) return [];

    return docSnap.data()?.comentarios || [];
  } catch (error) {
    console.error("❌ Error en obtenerComentariosService:", error);
    return [];
  }
};