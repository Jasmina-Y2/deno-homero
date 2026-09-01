import { db } from "../config/firebase.ts";

export const guardarComentarioService = async (publicacionId: string, comentario: any) => {
  try {
    const docRef = await db.collection("comentarios").add({
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
      .collection("comentarios")
      .where("publicacionId", "==", publicacionId)
      .get();

    return snapshot.docs.map((doc: any) => ({
      idDoc: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("❌ Error en obtenerComentariosService:", error);
    throw new Error("Error al obtener comentarios");
  }
};
