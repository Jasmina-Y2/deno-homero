import { db, fieldValue } from "../config/firebase.ts";
import { enviarPushAUsuario, obtenerInfoUsuarioEmisor } from "./notification.service.ts";

export const seguirUsuarioService = async (
  miUid: string,
  uidASeguir: string,
  nombreSeguidor?: string,
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

    // Disparar Notificación Push al usuario seguido
    if (miUid !== uidASeguir) {
      try {
        let nombre = nombreSeguidor;
        const emisorInfo = await obtenerInfoUsuarioEmisor(miUid);
        if (!nombre || nombre === "Un usuario" || nombre === "Alguien") {
          nombre = emisorInfo.nombre;
        }

        await enviarPushAUsuario(
          uidASeguir,
          "👤 ¡Nuevo Seguidor!",
          `${nombre} ha comenzado a seguirte.`,
          {
            idSeguidor: miUid,
            idUsuario: miUid,
            uidUsuario: miUid,
            nombreUsuario: nombre,
            fotoUsuario: emisorInfo.photoURL,
            tipo: "seguidor",
          },
        );
      } catch (pushErr) {
        console.warn("⚠️ No se pudo enviar notificación de nuevo seguidor:", pushErr);
      }
    }

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
