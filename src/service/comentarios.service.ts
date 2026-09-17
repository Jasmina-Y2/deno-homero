import { db } from "../config/firebase.ts";
import { enviarPushAUsuario, obtenerInfoUsuarioEmisor } from "./notification.service.ts";

export const guardarComentarioService = async (
  publicacionId: string,
  comentario: any,
) => {
  try {
    const idComentador =
      comentario?.idUsuario ||
      comentario?.uid ||
      comentario?.usuarioId ||
      comentario?.idAutor ||
      "";

    const textoComentario = String(
      comentario?.texto ||
      comentario?.comentario ||
      comentario?.mensaje ||
      comentario?.content ||
      "",
    ).trim();

    const esPropina = Boolean(
      comentario?.esPropina ||
      comentario?.tipo === "sticker" ||
      comentario?.tipoSticker ||
      textoComentario.startsWith("🎁") ||
      textoComentario.includes("Envió un sticker"),
    );

    // Evitar duplicados accidentales en Firestore (ventana de 10s)
    if (publicacionId && idComentador) {
      try {
        const diezSegundosAtras = new Date(Date.now() - 10000).toISOString();
        const dupSnap = await db.collection("Comentarios")
          .where("publicacionId", "==", publicacionId)
          .where("idAutor", "==", idComentador)
          .where("createdAt", ">=", diezSegundosAtras)
          .get();

        if (!dupSnap.empty) {
          for (const d of dupSnap.docs) {
            const dataD = d.data();
            const textoD = String(dataD.texto || dataD.mensaje || "").trim();
            const esPropinaD = Boolean(
              dataD.esPropina ||
              dataD.tipo === "sticker" ||
              dataD.tipoSticker ||
              textoD.startsWith("🎁") ||
              textoD.includes("Envió un sticker"),
            );

            if (esPropina && esPropinaD) {
              console.log(`ℹ️ [Comentario] Comentario de propina duplicado omitido para ${idComentador}`);
              return {
                success: true,
                idDoc: d.id,
                message: "Comentario ya registrado",
              };
            }
            if (textoD === textoComentario) {
              console.log(`ℹ️ [Comentario] Comentario idéntico reciente omitido para ${idComentador}`);
              return {
                success: true,
                idDoc: d.id,
                message: "Comentario ya registrado",
              };
            }
          }
        }
      } catch (_dupErr) {}
    }

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

      let nombreComentador =
        comentario?.nombre ||
        comentario?.usuario ||
        comentario?.name ||
        comentario?.autor ||
        "";

      let fotoComentador = comentario?.photoURL || comentario?.foto || comentario?.avatar;

      if (idComentador) {
        const infoEmisor = await obtenerInfoUsuarioEmisor(idComentador);
        if (!nombreComentador || nombreComentador === "Un lector" || nombreComentador === "Un usuario" || nombreComentador === "Alguien") {
          nombreComentador = infoEmisor.nombre;
        }
        if (!fotoComentador) {
          fotoComentador = infoEmisor.photoURL;
        }
      }

      // Notificar únicamente si el comentario no es del propio autor
      if (autorUid && autorUid !== idComentador) {
        const previewTexto =
          textoComentario.length > 50
            ? textoComentario.substring(0, 47) + "..."
            : textoComentario;

        await enviarPushAUsuario(
          autorUid,
          "💬 ¡Nuevo Comentario!",
          `${nombreComentador || "Un usuario"} comentó: "${previewTexto}"`,
          {
            idHistoria: publicacionId,
            idUsuario: idComentador,
            uidUsuario: idComentador,
            nombreUsuario: nombreComentador || "Un usuario",
            fotoUsuario: fotoComentador,
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

    const rawItems = snapshot.docs.map((doc: any) => ({
      idDoc: doc.id,
      id: doc.id,
      ...doc.data(),
    }));

    // Ordenar por fecha cronológica para visualización coherente
    rawItems.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || a.fecha || 0).getTime();
      const timeB = new Date(b.createdAt || b.fecha || 0).getTime();
      return timeA - timeB;
    });

    // Deduplicación inteligente: Fusionar comentarios duplicados de propinas/stickers
    const itemsUnicos: any[] = [];
    for (const c of rawItems) {
      if (!c) continue;
      const idAutorC = String(c.idAutor || c.idUsuario || c.uid || "").trim();
      const textoC = String(c.texto || c.comentario || c.mensaje || "").trim();
      const fechaC = new Date(c.createdAt || c.fecha || 0).getTime();
      const esPropinaC = Boolean(
        c.esPropina ||
        c.tipo === "sticker" ||
        c.tipoSticker ||
        textoC.startsWith("🎁") ||
        textoC.includes("Envió un sticker"),
      );

      const idxExistente = itemsUnicos.findIndex((existente) => {
        if (existente.idDoc && c.idDoc && existente.idDoc === c.idDoc) return true;
        if (existente.id && c.id && existente.id === c.id) return true;

        const idAutorE = String(existente.idAutor || existente.idUsuario || existente.uid || "").trim();
        const textoE = String(existente.texto || existente.comentario || existente.mensaje || "").trim();
        const fechaE = new Date(existente.createdAt || existente.fecha || 0).getTime();
        const esPropinaE = Boolean(
          existente.esPropina ||
          existente.tipo === "sticker" ||
          existente.tipoSticker ||
          textoE.startsWith("🎁") ||
          textoE.includes("Envió un sticker"),
        );

        // Si ambos son de propina/sticker del mismo autor en menos de 15 segundos
        if (esPropinaC && esPropinaE && idAutorC && idAutorE && idAutorC === idAutorE) {
          const diff = Math.abs(fechaC - fechaE);
          if (!isNaN(diff) && diff < 15000) {
            return true;
          }
        }

        // Si tienen el mismo texto del mismo autor en menos de 60 segundos
        if (idAutorC && idAutorE && idAutorC === idAutorE && textoC === textoE) {
          const diff = Math.abs(fechaC - fechaE);
          if (!isNaN(diff) && diff < 60000) {
            return true;
          }
        }

        return false;
      });

      if (idxExistente === -1) {
        itemsUnicos.push(c);
      } else {
        // Conservar el objeto con mejor formato visual (imagenSticker o formato 🎁)
        const existente = itemsUnicos[idxExistente];
        const nuevoTieneImagen = Boolean(c.imagenSticker || textoC.startsWith("🎁"));
        const viejoTieneImagen = Boolean(existente.imagenSticker || String(existente.texto).startsWith("🎁"));

        if (nuevoTieneImagen && !viejoTieneImagen) {
          itemsUnicos[idxExistente] = {
            ...existente,
            ...c,
          };
        }
      }
    }

    // Carga pasiva de los últimos 'limitCount' comentarios
    if (itemsUnicos.length > limitCount) {
      return itemsUnicos.slice(itemsUnicos.length - limitCount);
    }

    return itemsUnicos;
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
