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

export const eliminarCardPorIdService = async (
  idCard: string,
  userUid?: string,
  isAdmin?: boolean,
): Promise<{ success: boolean; motivo?: string }> => {
  const colecciones = ["CardHistoria", "Historia", "HistoriaInfo"];
  let encontrado = false;

  try {
    // Si se pasa userUid y NO es admin, verificamos pertenencia
    if (userUid && !isAdmin) {
      const cardSnap = await db.collection("CardHistoria")
        .where("id", "==", idCard)
        .get();

      if (!cardSnap.empty) {
        const cardData = cardSnap.docs[0].data();
        const idAutor = cardData.idAutor || cardData.uid || cardData.autorId;
        if (idAutor && idAutor !== userUid) {
          return { success: false, motivo: "FORBIDDEN" };
        }
      }
    }

    const batch = db.batch();
    let totalOperaciones = 0;

    for (const nombreCol of colecciones) {
      const snapshot = await db.collection(nombreCol)
        .where("id", "==", idCard)
        .get();

      if (!snapshot.empty) {
        encontrado = true;
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          totalOperaciones++;
        });
      }
    }
    if (encontrado && totalOperaciones > 0) {
      await batch.commit();
      return { success: true };
    }

    return { success: false, motivo: "NOT_FOUND" };
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
    const [historiaSnap, cardSnap, historiaInfoSnap] = await Promise.all([
      db.collection("Historia").where("id", "==", customId).get(),
      db.collection("CardHistoria").where("id", "==", customId).get(),
      db.collection("HistoriaInfo").where("id", "==", customId).get(),
    ]);

    if (historiaSnap.empty && cardSnap.empty && historiaInfoSnap.empty) {
      console.error(
        `❌ Error: El ID ${customId} no existe en la base de datos.`,
      );
      throw new Error("NOT_FOUND");
    }

    // Si se pasa userUid y NO es admin, verificamos pertenencia
    if (userUid && !isAdmin) {
      const cardData = !cardSnap.empty ? cardSnap.docs[0].data() : null;
      const historiaData = !historiaSnap.empty ? historiaSnap.docs[0].data() : null;
      const idAutor = cardData?.idAutor || cardData?.uid || historiaData?.idAutor || historiaData?.uid;
      if (idAutor && idAutor !== userUid) {
        throw new Error("FORBIDDEN");
      }
    }

    let urlsParaBorrar: string[] = [];
    if (!historiaSnap.empty) {
      const data = historiaSnap.docs[0].data();
      if (data.historia && Array.isArray(data.historia)) {
        urlsParaBorrar = data.historia.filter((item: any) => item.imagen).map((
          item: any,
        ) => item.imagen);
      }
    }
    if (!cardSnap.empty) {
      const data = cardSnap.docs[0].data();
      if (data.video) urlsParaBorrar.push(data.video);
      if (data.imagen) urlsParaBorrar.push(data.imagen);
      if (data.poster) urlsParaBorrar.push(data.poster);
      if (data.thumbnail) urlsParaBorrar.push(data.thumbnail);
      if (data.ogImage) urlsParaBorrar.push(data.ogImage);
    }
    if (!historiaInfoSnap.empty) {
      const data = historiaInfoSnap.docs[0].data();
      if (data.video) urlsParaBorrar.push(data.video);
      if (data.imagen) urlsParaBorrar.push(data.imagen);
      if (data.poster) urlsParaBorrar.push(data.poster);
      if (data.thumbnail) urlsParaBorrar.push(data.thumbnail);
      if (data.ogImage) urlsParaBorrar.push(data.ogImage);
    }
    if (urlsParaBorrar.length > 0) {
      const results = await Promise.allSettled(
        urlsParaBorrar.map((url) => deleteS3ObjectHelper(url)),
      );
      const fallidos = results.filter((r) => r.status === "rejected");
      if (fallidos.length > 0) {
        console.warn(
          `⚠️ Se intentaron borrar ${urlsParaBorrar.length} archivos, pero ${fallidos.length} fallaron.`,
        );
      }
    }
    const batch = db.batch();
    let docsCount = 0;
    [historiaSnap, cardSnap, historiaInfoSnap].forEach((snap) => {
      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        docsCount++;
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    throw error;
  }
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
