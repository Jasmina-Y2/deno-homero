import { db } from "../config/firebase.ts";

export const guardarComentarioService = async (
  publicacionId: string,
  comentario: any,
) => {
  try {
    const docRef = await db.collection("Comentarios").add({
      publicacionId,
      ...(typeof comentario === "object" ? comentario : { comentario }),
      createdAt: new Date().toISOString(),
    });
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
