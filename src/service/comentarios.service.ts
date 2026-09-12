import { db } from "../config/firebase.ts";
import { enviarPushAUsuario } from "./notification.service.ts";

export const guardarComentarioService = async (
  publicacionId: string,
  comentario: any,
) => {
  try {
    const fecha = new Date().toISOString();
    const docRef = await db.collection("Comentarios").add({
      publicacionId,
      ...(typeof comentario === "object" ? comentario : { comentario }),
      createdAt: fecha,
      fecha: fecha,
    });

    // Disparar Notificación Push e In-App al autor de la historia
    try {
      let autorUid: string | null = null;
      let tituloHistoria = "tu historia";

      // 1. Buscar autor en CardHistoria
      const cardSnap = await db.collection("CardHistoria").where("id", "==", publicacionId).get();
      if (!cardSnap.empty) {
        const cardData = cardSnap.docs[0].data();
        autorUid = cardData.idAutor || cardData.uidAutor || cardData.autorId;
        if (cardData.titulo) tituloHistoria = cardData.titulo;
      } else {
        // 2. Buscar en HistoriaInfo
        const hSnap = await db.collection("HistoriaInfo").where("id", "==", publicacionId).get();
        if (!hSnap.empty) {
          const hData = hSnap.docs[0].data();
          autorUid = hData.idAutor || hData.uidAutor;
          if (hData.titulo) tituloHistoria = hData.titulo;
        } else {
          // 3. Buscar directo en Historia
          const hDirect = await db.collection("Historia").doc(publicacionId).get();
          if (hDirect.exists) {
            const hData = hDirect.data();
            autorUid = hData?.idAutor;
            if (hData?.titulo) tituloHistoria = hData.titulo;
          }
        }
      }

      const idComentador =
        comentario?.idUsuario ||
        comentario?.uid ||
        comentario?.usuarioId ||
        comentario?.idAutor ||
        "";

      const nombreComentador =
        comentario?.nombre ||
        comentario?.usuario ||
        comentario?.name ||
        comentario?.autor ||
        "Un lector";

      const textoComentario =
        comentario?.texto ||
        comentario?.comentario ||
        comentario?.mensaje ||
        comentario?.content ||
        "";

      // Notificar únicamente si el comentario no es del propio autor
      if (autorUid && autorUid !== idComentador) {
        const previewTexto =
          textoComentario.length > 50
            ? textoComentario.substring(0, 47) + "..."
            : textoComentario;

        await enviarPushAUsuario(
          autorUid,
          "💬 ¡Nuevo Comentario!",
          `${nombreComentador} comentó: "${previewTexto}"`,
          {
            idHistoria: publicacionId,
            idUsuario: idComentador,
            tipo: "comentario",
            tituloHistoria,
          },
        );
      }
    } catch (notifErr) {
      console.warn("⚠️ No se pudo disparar notificación de comentario:", notifErr);
    }

    return {
      success: true,
      idDoc: docRef.id,
      message: "Comentario guardado exitosamente",
    };
  } catch (error) {
    console.error("❌ Error en guardarComentarioService:", error);
    throw new Error("Error al guardar el comentario en la base de datos");
  }
};

export const obtenerComentariosService = async (
  publicacionId: string,
  limitCount = 50,
) => {
  try {
    const snapshot = await db
      .collection("Comentarios")
      .where("publicacionId", "==", publicacionId)
      .get();

    const items = snapshot.docs.map((doc: any) => ({
      idDoc: doc.id,
      id: doc.id,
      ...doc.data(),
    }));

    // Ordenar por fecha cronológica para visualización coherente
    items.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || a.fecha || 0).getTime();
      const timeB = new Date(b.createdAt || b.fecha || 0).getTime();
      return timeA - timeB;
    });

    // Carga pasiva de los últimos 'limitCount' comentarios
    if (items.length > limitCount) {
      return items.slice(items.length - limitCount);
    }

    return items;
  } catch (error) {
    console.error("❌ Error en obtenerComentariosService:", error);
    throw new Error("Error al obtener comentarios");
  }
};

export const eliminarComentarioService = async (idComentario: string) => {
  try {
    const docRef = db.collection("Comentarios").doc(idComentario);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return false;
    }

    await docRef.delete();
    return true;
  } catch (error) {
    console.error("❌ Error en eliminarComentarioService:", error);
    throw new Error("Error al eliminar el comentario de la base de datos");
  }
};
