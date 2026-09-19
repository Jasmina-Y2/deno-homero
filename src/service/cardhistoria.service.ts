import { db } from "../config/firebase.ts";
import { CardHistoria } from "../models/cardhistoria.model.ts";
import { deleteS3ObjectHelper } from "../service/aws.service.ts";

export const guardarCardHistoriaEnFirestoreService = async (
  data: CardHistoria,
): Promise<string> => {
  try {
    const docRef = await db.collection("CardHistoria").add(data);
    console.log("✅ CARD guardada. ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error guardando Card:", error);
    throw new Error("Error al guardar la Card");
  }
};

export const obtenerCardHistoriaService = async (
  limitCount?: number,
): Promise<CardHistoria[]> => {
  try {
    let query: any = db.collection("CardHistoria").orderBy("fecha", "desc");
    if (limitCount && limitCount > 0) {
      query = query.limit(limitCount);
    }
    const snapshot = await query.get();
    if (snapshot.empty) {
      console.log("⚠️ La colección CardHistoria está vacía.");
      return [];
    }

    const data = snapshot.docs.map((doc: any) => ({
      idDoc: doc.id,
      ...doc.data(),
    })) as CardHistoria[];

    console.log(`✅ Se obtuvieron ${data.length} historias correctamente.`);
    return data;
  } catch (error) {
    console.error("❌ Error obteniendo historias:", error);
    throw new Error("Error al obtener la lista de historias");
  }
};

/**
 * Extrae recursivamente todas las URLs de S3 (imágenes, videos, audios mp3/wav, portadas, escenas)
 * contenidas en un documento, ignorando fotos de perfil y assets por defecto.
 */
export const extraerUrlsS3DeObjeto = (data: any): string[] => {
  const urls: string[] = [];
  if (!data) return urls;

  const agregarSiEsUrlValida = (val: any) => {
    if (typeof val === "string" && val.trim() !== "") {
      const v = val.trim();
      if (
        (v.startsWith("http://") ||
          v.startsWith("https://") ||
          v.includes(".amazonaws.com/") ||
          v.includes(".s3.")) &&
        !v.includes("DEFAULT.png") &&
        !v.includes("PROFILE.jpg") &&
        !v.includes("/user/imagen.jpg")
      ) {
        urls.push(v);
      }
    }
  };

  const recorrer = (obj: any, clavePadre = "") => {
    if (!obj) return;
    if (typeof obj === "string") {
      agregarSiEsUrlValida(obj);
      return;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        recorrer(item, clavePadre);
      }
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        // Evitar eliminar fotos de perfil del autor/usuarios
        if (
          k === "photoURL" ||
          k === "foto" ||
          k === "avatar" ||
          k === "fotoPerfil" ||
          k === "autor"
        ) {
          continue;
        }

        if (typeof v === "string") {
          agregarSiEsUrlValida(v);
        } else if (typeof v === "object" && v !== null) {
          recorrer(v, k);
        }
      }
    }
  };

  recorrer(data);
  return Array.from(new Set(urls));
};

export const eliminarCardPorIdService = async (
  idCard: string,
  userUid?: string,
  isAdmin?: boolean,
): Promise<{ success: boolean; motivo?: string }> => {
  try {
    return await ejecutarEliminacionCompletaHistoria(idCard, userUid, isAdmin);
  } catch (error) {
    console.error("❌ Error en servicio eliminarCardPorId:", error);
    throw new Error("Error al intentar eliminar la historia");
  }
};

export const eliminarImagenesDeHistoria = async (
  customId: string,
  userUid?: string,
  isAdmin?: boolean,
) => {
  try {
    const resultado = await ejecutarEliminacionCompletaHistoria(
      customId,
      userUid,
      isAdmin,
    );
    if (!resultado.success) {
      if (resultado.motivo === "FORBIDDEN") throw new Error("FORBIDDEN");
      if (resultado.motivo === "NOT_FOUND") throw new Error("NOT_FOUND");
    }
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Función centralizada que elimina la historia, sus cards, info, audios y limpia todos los archivos multimedia de AWS S3.
 */
export const ejecutarEliminacionCompletaHistoria = async (
  idHistoria: string,
  userUid?: string,
  isAdmin?: boolean,
): Promise<{ success: boolean; motivo?: string }> => {
  const [historiaSnap, cardSnap, historiaInfoSnap, audioSnap] =
    await Promise.all([
      db.collection("Historia").where("id", "==", idHistoria).get(),
      db.collection("CardHistoria").where("id", "==", idHistoria).get(),
      db.collection("HistoriaInfo").where("id", "==", idHistoria).get(),
      db.collection("AudioHistoria").where("id", "==", idHistoria).get(),
    ]);

  const directAudioDoc = await db.collection("AudioHistoria").doc(idHistoria).get();

  const todosVacio = historiaSnap.empty &&
    cardSnap.empty &&
    historiaInfoSnap.empty &&
    audioSnap.empty &&
    !directAudioDoc.exists;

  if (todosVacio) {
    console.error(`❌ Error: El ID ${idHistoria} no existe en la base de datos.`);
    return { success: false, motivo: "NOT_FOUND" };
  }

  // Verificación de pertenencia si se pasa userUid y no es admin
  if (userUid && !isAdmin) {
    const cardData = !cardSnap.empty ? cardSnap.docs[0].data() : null;
    const historiaData = !historiaSnap.empty ? historiaSnap.docs[0].data() : null;
    const infoData = !historiaInfoSnap.empty ? historiaInfoSnap.docs[0].data() : null;

    const idAutor = cardData?.idAutor ||
      cardData?.uid ||
      cardData?.autorId ||
      historiaData?.idAutor ||
      historiaData?.uid ||
      infoData?.idAutor ||
      infoData?.uid;

    if (idAutor && idAutor !== userUid) {
      return { success: false, motivo: "FORBIDDEN" };
    }
  }

  // 1. Recopilar todas las URLs de S3 a eliminar (videos, portadas, imágenes, audioES, audioEN, música, etc.)
  const urlsParaBorrar: string[] = [];

  [historiaSnap, cardSnap, historiaInfoSnap, audioSnap].forEach((snap) => {
    snap.docs.forEach((doc) => {
      const urlsDoc = extraerUrlsS3DeObjeto(doc.data());
      urlsParaBorrar.push(...urlsDoc);
    });
  });

  if (directAudioDoc.exists) {
    const urlsAudio = extraerUrlsS3DeObjeto(directAudioDoc.data());
    urlsParaBorrar.push(...urlsAudio);
  }

  const urlsUnicas = Array.from(new Set(urlsParaBorrar));

  // 2. Eliminar archivos de S3 en paralelo
  if (urlsUnicas.length > 0) {
    console.log(
      `🗑️ Eliminando ${urlsUnicas.length} archivos multimedia/audios de S3 para la historia ${idHistoria}...`,
    );
    const results = await Promise.allSettled(
      urlsUnicas.map((url) => deleteS3ObjectHelper(url)),
    );
    const fallidos = results.filter((r) => r.status === "rejected");
    if (fallidos.length > 0) {
      console.warn(
        `⚠️ Se intentaron borrar ${urlsUnicas.length} archivos de S3, pero ${fallidos.length} fallaron.`,
      );
    } else {
      console.log(`✅ Todos los archivos de S3 fueron eliminados correctamente.`);
    }
  }

  // 3. Eliminar documentos de Firestore en lote (batch)
  const batch = db.batch();
  let docsCount = 0;

  [historiaSnap, cardSnap, historiaInfoSnap, audioSnap].forEach((snap) => {
    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
      docsCount++;
    });
  });

  if (directAudioDoc.exists) {
    batch.delete(directAudioDoc.ref);
    docsCount++;
  }

  if (docsCount > 0) {
    await batch.commit();
    console.log(
      `✅ Eliminados ${docsCount} documentos de Firestore para la historia ${idHistoria}`,
    );
  }

  return { success: true };
};
export const getHistoriaCardByCustomId2Service = async (idAutor: string) => {
  try {
    const snapshot = await db.collection("CardHistoria")
      .where("idAutor", "==", idAutor)
      .get();
    return snapshot.docs.map((doc) => ({ idDoc: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("❌ Error en getHistoriaCardByCustomId2Service:", error);
    throw new Error("Error al obtener las tarjetas de historia");
  }
};
export const getHistoriaCardByCustomIdService = async (id: string) => {
  try {
    const snapshot = await db.collection("CardHistoria")
      .where("id", "==", id)
      .get();
    return snapshot.docs.map((doc) => ({ idDoc: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("❌ Error en getHistoriaCardByCustomId2Service:", error);
    throw new Error("Error al obtener las tarjetas de historia");
  }
};
