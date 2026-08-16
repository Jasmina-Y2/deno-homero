import { db, fieldValue } from "../config/firebase.ts";

export const seguirUsuarioService = async (
  miUid: string,
  uidASeguir: string,
) => {
  try {
    const seguirUserRef = db.collection("Seguir_User").doc(miUid);
    const seguirRef = db.collection("Seguir").doc(uidASeguir);

    await seguirUserRef.set({
      siguiendo: fieldValue.arrayUnion(uidASeguir),
    }, { merge: true });

    await seguirRef.set({
      seguidores: fieldValue.arrayUnion(miUid),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("❌ Error en seguirUsuarioService:", error);
    throw new Error("No se pudo seguir al usuario");
  }
};

export const dejarDeSeguirService = async (
  miUid: string,
  uidADejar: string,
) => {
  try {
    const seguirUserRef = db.collection("Seguir_User").doc(miUid);
    const seguirRef = db.collection("Seguir").doc(uidADejar);

    await seguirUserRef.set({
      siguiendo: fieldValue.arrayRemove(uidADejar),
    }, { merge: true });

    await seguirRef.set({
      seguidores: fieldValue.arrayRemove(miUid),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error("❌ Error en dejarDeSeguirService:", error);
    throw new Error("No se pudo dejar de seguir al usuario");
  }
};

export const getGenteQueYoSigoService = async (uid: string) => {
  try {
    const docSnap = await db.collection("Seguir_User").doc(uid).get();
    return docSnap.exists ? docSnap.data()?.siguiendo || [] : [];
  } catch (error) {
    console.error("❌ Error en getGenteQueYoSigoService:", error);
    return [];
  }
};
