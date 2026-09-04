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

export const obtenerComentariosService = async (publicacionId: string) => {
  try {
    const snapshot = await db
      .collection("Comentarios")
      .where("publicacionId", "==", publicacionId)
      .get();

    return snapshot.docs.map((doc: any) => ({
      idDoc: doc.id,
      id: doc.id,
      ...doc.data(),
    }));
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
