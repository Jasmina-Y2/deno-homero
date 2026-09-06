import { db } from "../config/firebase.ts";
import { BovedaPinData } from "../models/boveda.model.ts";

/**
 * Obtiene el PIN de la bóveda de un usuario consultando primero en la colección "users"
 * (campo `bovedaPin`) y luego como respaldo en la colección "bovedaPins" (campo `pin`).
 * 
 * @param uid Identificador único del usuario
 * @returns El PIN como string o null si no se encuentra
 */
export const obtenerPinBovedaFirebase = async (uid: string): Promise<string | null> => {
  if (!uid || typeof uid !== "string" || uid.trim() === "") return null;
  const cleanUid = uid.trim();

  try {
    // 1. Buscar en la colección "users" por ID de documento
    const userRef = db.collection("users").doc(cleanUid);
    const snap = await userRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data?.bovedaPin !== undefined && data?.bovedaPin !== null && data?.bovedaPin !== "") {
        return String(data.bovedaPin);
      }
    } else {
      // Búsqueda por campo "uid" en caso de que el ID del documento sea autogenerado
      const userQuery = await db.collection("users").where("uid", "==", cleanUid).limit(1).get();
      if (!userQuery.empty) {
        const data = userQuery.docs[0].data();
        if (data?.bovedaPin !== undefined && data?.bovedaPin !== null && data?.bovedaPin !== "") {
          return String(data.bovedaPin);
        }
      }
    }

    // 2. Buscar en la colección de respaldo "bovedaPins" por ID de documento
    const bovedaRef = db.collection("bovedaPins").doc(cleanUid);
    const bovedaSnap = await bovedaRef.get();
    if (bovedaSnap.exists) {
      const bovedaData = bovedaSnap.data();
      if (bovedaData?.pin !== undefined && bovedaData?.pin !== null && bovedaData?.pin !== "") {
        return String(bovedaData.pin);
      }
    } else {
      // Búsqueda por campo "uid" en caso de que el ID del documento sea autogenerado
      const bovedaQuery = await db.collection("bovedaPins").where("uid", "==", cleanUid).limit(1).get();
      if (!bovedaQuery.empty) {
        const bovedaData = bovedaQuery.docs[0].data();
        if (bovedaData?.pin !== undefined && bovedaData?.pin !== null && bovedaData?.pin !== "") {
          return String(bovedaData.pin);
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error al obtener PIN de respaldo desde Firebase:", error);
    return null;
  }
};

/**
 * Alias para estándar de nomenclatura del servicio
 */
export const obtenerPinBovedaService = obtenerPinBovedaFirebase;

/**
 * Guarda o actualiza el PIN de la bóveda de un usuario tanto en `bovedaPins` como en `users`.
 * 
 * @param uid Identificador único del usuario
 * @param pin Código PIN a registrar
 */
export const guardarPinBovedaService = async (
  uid: string,
  pin: string,
): Promise<BovedaPinData> => {
  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    throw new Error("El UID del usuario es requerido");
  }
  if (pin === undefined || pin === null || String(pin).trim() === "") {
    throw new Error("El PIN es requerido");
  }

  const cleanUid = uid.trim();
  const cleanPin = String(pin).trim();
  const fechaActualizacion = new Date().toISOString();

  // 1. Guardar en colección bovedaPins
  await db.collection("bovedaPins").doc(cleanUid).set(
    {
      uid: cleanUid,
      pin: cleanPin,
      fechaActualizacion,
    },
    { merge: true },
  );

  // 2. Actualizar también en colección users si existe
  const userRef = db.collection("users").doc(cleanUid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.update({
      bovedaPin: cleanPin,
      fechaActualizacion,
    });
  } else {
    const userQuery = await db.collection("users").where("uid", "==", cleanUid).limit(1).get();
    if (!userQuery.empty) {
      await userQuery.docs[0].ref.update({
        bovedaPin: cleanPin,
        fechaActualizacion,
      });
    }
  }

  console.log(`🔒 PIN de bóveda actualizado para usuario: ${cleanUid}`);

  return {
    uid: cleanUid,
    pin: cleanPin,
    fechaActualizacion,
  };
};
