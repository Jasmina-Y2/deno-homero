import { db, fieldValue } from "../config/firebase.ts";
import {
  ActividadDiariaUsuario,
  BilleteraUsuario,
  DatosUsuario,
  PerfilUsuario,
  SistemaUsuario,
  SuscripcionItem,
  UsuarioDocumento,
} from "../models/users.model.ts";
import { enviarPushActualizarPerfil } from "./notification.service.ts";

/**
 * Lista de campos obsoletos/antiguos que nunca deben estar en la raíz de Firestore
 */
const CAMPOS_OBSOLETOS_RAIZ = [
  "name",
  "email",
  "photoURL",
  "foto",
  "descripcion",
  "rol",
  "verificado",
  "marco_perfil_id",
  "marco_perfil",
  "selectedFrame",
  "suscription",
  "suscripcion",
  "fechaSuscripcion",
  "fechaVencimiento",
  "diasDuracion",
  "walletBalance",
  "monedas",
  "ElevensLab",
  "mesRecargaFreeElevenLabs",
  "anunciosVistosHoy",
  "fechaUltimoAnuncio",
  "dia_racha",
  "fechaUltimaRacha",
  "fcmToken",
  "fcm_token",
  "tokenActualizadoEn",
  "bovedaPin",
  "metodo",
  "ADMIN",
  "admin",
  "activo",
  "fechaRegistro",
  "fechaActualizacion",
  "sistema.fcm_token",
  "sistema.tokenActualizadoEn",
];

/**
 * Genera el objeto de eliminación para campos fantasmas/obsoletos
 */
export const obtenerEliminacionesObsoletas = (rawData: any): Record<string, any> => {
  const deletes: Record<string, any> = {};
  for (const key of CAMPOS_OBSOLETOS_RAIZ) {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      if (rawData && rawData[parent] && child in rawData[parent]) {
        deletes[key] = fieldValue.delete();
      }
    } else if (rawData && key in rawData) {
      deletes[key] = fieldValue.delete();
    }
  }
  return deletes;
};

/**
 * Normaliza un documento de usuario de Firestore a la estructura estrictamente modular:
 * { uid, perfil, suscripciones, billetera, actividadDiaria, sistema }
 */
export const normalizarUsuarioDoc = (data: any, docId?: string): UsuarioDocumento => {
  if (!data) {
    data = {};
  }

  const uid = data.uid || docId || "";
  const ahora = new Date().toISOString();
  const mesActual = ahora.slice(0, 7);

  // 1. Perfil
  const perfil: PerfilUsuario = {
    name: data.perfil?.name || data.name || data.nombre || data.displayName || `Usuario_${uid.slice(0, 6)}`,
    email: data.perfil?.email || data.email || data.correo || "",
    photoURL: data.perfil?.photoURL || data.photoURL || data.foto || "https://mybuckethomero2.s3.us-east-1.amazonaws.com/user/imagen.jpg",
    descripcion: data.perfil?.descripcion || data.descripcion || "Soy creador original de homero",
    rol: data.perfil?.rol || data.rol || "usuario",
    verificado: Boolean(data.perfil?.verificado ?? data.verificado ?? false),
    marco_perfil_id: data.perfil?.marco_perfil_id ?? data.marco_perfil_id ?? null,
  };

  // 2. Suscripciones (Array exclusivo de suscripciones)
  let suscripciones: SuscripcionItem[] = [];
  if (Array.isArray(data.suscripciones)) {
    suscripciones = data.suscripciones.map((s: any) => ({
      entitlementId: s.entitlementId || s.id || s.tipo || "lector_vip",
      productId: s.productId || s.product_id || (s.entitlementId === "creador_estelar" ? "homero_creador_estelar:creador-estelar-mensual" : "homero_lector_vip:lector-vip-mensual"),
      activo: Boolean(s.activo),
      fechaSuscripcion: s.fechaSuscripcion || null,
      fechaVencimiento: s.fechaVencimiento || null,
      diasDuracion: Number(s.diasDuracion || 30),
      autoRenovacion: Boolean(s.autoRenovacion ?? false),
    }));
  } else {
    // Migrar suscripción legada si existía
    const legacyActivo = Boolean(data.suscription ?? data.suscripcion?.activo ?? (data.suscripcion === true));
    const legacyFechaSuscripcion = data.suscripcion?.fechaSuscripcion ?? data.fechaSuscripcion ?? null;
    const legacyFechaVencimiento = data.suscripcion?.fechaVencimiento ?? data.fechaVencimiento ?? null;
    const legacyDias = Number(data.suscripcion?.diasDuracion ?? data.diasDuracion ?? 30);

    const lectorActivo = Boolean(
      data.suscripcion?.lector?.activo ??
      (data.suscripcion?.tipo === "lector" || data.suscripcion?.tipo === "ambos" ? legacyActivo : false)
    );
    const escritorActivo = Boolean(
      data.suscripcion?.escritor?.activo ??
      (data.suscripcion?.tipo === "escritor" || data.suscripcion?.tipo === "ambos" || (!data.suscripcion?.tipo && legacyActivo) ? legacyActivo : false)
    );

    if (lectorActivo) {
      suscripciones.push({
        entitlementId: "lector_vip",
        productId: "homero_lector_vip:lector-vip-mensual",
        activo: true,
        fechaSuscripcion: data.suscripcion?.lector?.fechaSuscripcion ?? legacyFechaSuscripcion,
        fechaVencimiento: data.suscripcion?.lector?.fechaVencimiento ?? legacyFechaVencimiento,
        diasDuracion: legacyDias,
        autoRenovacion: false,
      });
    }

    if (escritorActivo) {
      suscripciones.push({
        entitlementId: "creador_estelar",
        productId: "homero_creador_estelar:creador-estelar-mensual",
        activo: true,
        fechaSuscripcion: data.suscripcion?.escritor?.fechaSuscripcion ?? legacyFechaSuscripcion,
        fechaVencimiento: data.suscripcion?.escritor?.fechaVencimiento ?? legacyFechaVencimiento,
        diasDuracion: legacyDias,
        autoRenovacion: false,
      });
    }
  }

  const tieneEscritorActivo = suscripciones.some(
    (s) => (s.entitlementId.toLowerCase().includes("creador") || s.entitlementId.toLowerCase().includes("escritor")) && s.activo
  );

  // 3. Billetera
  const billetera: BilleteraUsuario = {
    walletBalance: Number(data.billetera?.walletBalance ?? data.walletBalance ?? 0),
    elevensLab: Number(data.billetera?.elevensLab ?? data.ElevensLab ?? (tieneEscritorActivo ? 15 : 2)),
    mesRecargaFreeElevenLabs: data.billetera?.mesRecargaFreeElevenLabs || data.mesRecargaFreeElevenLabs || mesActual,
  };

  // 4. Actividad Diaria
  const actividadDiaria: ActividadDiariaUsuario = {
    anunciosVistosHoy: Number(data.actividadDiaria?.anunciosVistosHoy ?? data.anunciosVistosHoy ?? 0),
    fechaUltimoAnuncio: data.actividadDiaria?.fechaUltimoAnuncio || data.fechaUltimoAnuncio || "",
    dia_racha: Number(data.actividadDiaria?.dia_racha ?? data.dia_racha ?? 0),
    fechaUltimaRacha: data.actividadDiaria?.fechaUltimaRacha || data.fechaUltimaRacha || null,
  };

  // 5. Sistema (ÚNICO fcmToken, sin duplicados)
  const fcmTokenVal = data.sistema?.fcmToken || data.sistema?.fcm_token || data.fcmToken || data.fcm_token || "";
  const activoFinal = Boolean(data.sistema?.activo ?? data.activo ?? true);
  const baneadoFinal = Boolean(data.sistema?.baneado ?? false);

  const sistema: SistemaUsuario = {
    fcmToken: fcmTokenVal,
    ultimoDeviceId: data.sistema?.ultimoDeviceId || data.ultimoDeviceId || "",
    bovedaPin: data.sistema?.bovedaPin || data.bovedaPin || "",
    metodo: data.sistema?.metodo || data.metodo || "email",
    ADMIN: Boolean(data.sistema?.ADMIN ?? data.ADMIN ?? (perfil.rol === "admin" || data.admin === true)),
    activo: activoFinal,
    baneado: baneadoFinal,
    dispositivoBloqueado: Boolean(data.sistema?.dispositivoBloqueado ?? false),
    fechaRegistro: data.sistema?.fechaRegistro || data.fechaRegistro || data.createdAt || ahora,
    fechaActualizacion: data.sistema?.fechaActualizacion || data.fechaActualizacion || ahora,
  };

  return {
    uid,
    perfil,
    suscripciones,
    billetera,
    actividadDiaria,
    sistema,
  };
};

/**
 * Obtiene todos los usuarios normalizados
 */
export const getUsuariosService = async () => {
  try {
    const snapshot = await db.collection("users").get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return normalizarUsuarioDoc(data, doc.id);
    });
  } catch (error) {
    console.error("❌ Error en getUsuariosService:", error);
    throw new Error("Error al obtener la lista de usuarios");
  }
};

/**
 * Verifica si un marco de perfil corresponde a PRO / Creador / Escritor
 */
export const esMarcoPro = (marcoId?: string | number | null): boolean => {
  if (!marcoId) return false;
  const id = String(marcoId).toLowerCase().trim();
  return (
    id === "pro_gold" ||
    id === "pro" ||
    id === "marco_pro" ||
    id.includes("marco_pro") ||
    id.includes("pro_gold")
  );
};

/**
 * Verifica si un marco de perfil corresponde a VIP / Lector
 */
export const esMarcoVip = (marcoId?: string | number | null): boolean => {
  if (!marcoId) return false;
  const id = String(marcoId).toLowerCase().trim();
  return (
    id === "vip_gold" ||
    id === "vip" ||
    id === "marco_vip" ||
    id.includes("marco_vip") ||
    id.includes("vip_gold")
  );
};

/**
 * Verifica si un marco de perfil es exclusivo de suscripción (ya sea PRO o VIP)
 */
export const esMarcoDeSuscripcion = (marcoId?: string | number | null): boolean => {
  return esMarcoPro(marcoId) || esMarcoVip(marcoId);
};

/**
 * Verifica si el usuario cuenta con alguna suscripción activa de tipo Lector VIP
 */
export const tieneSubLectorActiva = (suscripciones: SuscripcionItem[] = []): boolean => {
  return suscripciones.some((s) => {
    if (!s.activo) return false;
    const id = (s.entitlementId || "").toLowerCase();
    const pid = (s.productId || "").toLowerCase();
    return id.includes("lector") || id.includes("vip") || id.includes("reader") || pid.includes("lector") || pid.includes("reader");
  });
};

/**
 * Verifica si el usuario cuenta con alguna suscripción activa de tipo Escritor / Creador PRO
 */
export const tieneSubEscritorActiva = (suscripciones: SuscripcionItem[] = []): boolean => {
  return suscripciones.some((s) => {
    if (!s.activo) return false;
    const id = (s.entitlementId || "").toLowerCase();
    const pid = (s.productId || "").toLowerCase();
    return (
      id.includes("creador") ||
      id.includes("escritor") ||
      id.includes("estelar") ||
      id.includes("writer") ||
      id.includes("author") ||
      id.includes("pro") ||
      pid.includes("creador") ||
      pid.includes("escritor") ||
      pid.includes("estelar")
    );
  });
};

/**
 * Verifica si el usuario cuenta con cualquier suscripción activa
 */
export const tieneSubGlobalActiva = (suscripciones: SuscripcionItem[] = []): boolean => {
  return suscripciones.some((s) => s.activo === true);
};

/**
 * Determina si el marco actual debe removerse debido al estado de las suscripciones.
 * - Si no tiene ninguna suscripción activa, se remueven todos los marcos de suscripción (PRO y VIP).
 * - Si tiene marco PRO pero no tiene suscripción de escritor/creador activa, se remueve.
 * - Si tiene marco VIP pero no tiene suscripción de lector activa, se remueve.
 */
export const debeRemoverMarcoPorSuscripcion = (
  marcoId: string | number | null | undefined,
  tieneActivas: boolean,
  tieneEscritorActivo: boolean,
  tieneLectorActivo: boolean,
): boolean => {
  if (!marcoId) return false;
  const marcoStr = String(marcoId).trim();
  if (!marcoStr || marcoStr === "none" || marcoStr === "null" || marcoStr === "undefined") {
    return false;
  }

  if (!esMarcoDeSuscripcion(marcoStr)) {
    return false;
  }

  // Si no tiene ninguna suscripción activa, se retira de inmediato
  if (!tieneActivas) {
    return true;
  }

  // Si tiene marco PRO pero ya no tiene suscripción de creador/escritor activa
  if (esMarcoPro(marcoStr) && !tieneEscritorActivo) {
    return true;
  }

  // Si tiene marco VIP pero ya no tiene suscripción de lector activa
  if (esMarcoVip(marcoStr) && !tieneLectorActivo) {
    return true;
  }

  return false;
};

/**
 * Verifica expiración de suscripciones y limpia campos fantasmas/obsoletos del documento en Firestore
 */
const verificarExpiracionSuscripcion = async (docRef: any, rawData: any) => {
  let necesitaLimpieza = false;
  const updateData: Record<string, any> = obtenerEliminacionesObsoletas(rawData);

  if (Object.keys(updateData).length > 0) {
    necesitaLimpieza = true;
  }

  const normalizado = normalizarUsuarioDoc(rawData, docRef.id);
  const ahora = new Date();
  const mesActual = ahora.toISOString().slice(0, 7);

  let suscripcionModificada = false;

  // 1. Verificar expiración de cada item en suscripciones
  for (const sub of normalizado.suscripciones) {
    if (sub.activo && sub.fechaVencimiento) {
      const fechaVenc = new Date(sub.fechaVencimiento);
      if (ahora > fechaVenc) {
        sub.activo = false;
        suscripcionModificada = true;
        necesitaLimpieza = true;
      }
    }
  }

  const tieneActivas = tieneSubGlobalActiva(normalizado.suscripciones);
  const tieneEscritorActivo = tieneSubEscritorActiva(normalizado.suscripciones);
  const tieneLectorActivo = tieneSubLectorActiva(normalizado.suscripciones);

  if (suscripcionModificada) {
    updateData.suscripciones = normalizado.suscripciones;
    normalizado.sistema.fechaActualizacion = ahora.toISOString();
    updateData["sistema.fechaActualizacion"] = normalizado.sistema.fechaActualizacion;
  }

  // Si dejó de tener suscripción o ya no tiene la suscripción requerida para su marco PRO o VIP, se le retira y se pone null
  let marcoRemovido = false;
  const marcoActual = normalizado.perfil.marco_perfil_id;
  if (debeRemoverMarcoPorSuscripcion(marcoActual, tieneActivas, tieneEscritorActivo, tieneLectorActivo)) {
    console.log(`🚫 Retirando marco de suscripción '${marcoActual}' para usuario ${normalizado.uid} (perfil.marco_perfil_id = null)`);
    normalizado.perfil.marco_perfil_id = null;
    updateData["perfil.marco_perfil_id"] = null;
    normalizado.sistema.fechaActualizacion = ahora.toISOString();
    updateData["sistema.fechaActualizacion"] = normalizado.sistema.fechaActualizacion;
    necesitaLimpieza = true;
    marcoRemovido = true;
  }

  // 2. Recarga mensual gratuita de 2 créditos de ElevenLabs si no tiene creador activo
  if (!tieneEscritorActivo) {
    const mesUltimaRecarga = normalizado.billetera.mesRecargaFreeElevenLabs;
    if (mesUltimaRecarga !== mesActual) {
      normalizado.billetera.elevensLab = 2;
      normalizado.billetera.mesRecargaFreeElevenLabs = mesActual;
      updateData["billetera.elevensLab"] = 2;
      updateData["billetera.mesRecargaFreeElevenLabs"] = mesActual;
      necesitaLimpieza = true;
    }
  }

  if (necesitaLimpieza) {
    try {
      await docRef.update(updateData);
      console.log(`🧹 Documento limpiado y normalizado para usuario ${normalizado.uid}`);

      if ((suscripcionModificada && !tieneActivas) || marcoRemovido) {
        const token = normalizado.sistema.fcmToken;
        if (token) {
          enviarPushActualizarPerfil(token).catch((err) =>
            console.error("⚠️ [FCM] Error enviando push tras expiración/marco:", err)
          );
        }
      }
    } catch (err) {
      console.error("Error al persistir expiración/limpieza de usuario:", err);
    }
  }

  return normalizado;
};

/**
 * Obtiene el usuario por UID normalizado
 */
export const getUsuarioByUidService = async (uid: string) => {
  try {
    const directDoc = await db.collection("users").doc(uid).get();
    if (directDoc.exists) {
      const data = await verificarExpiracionSuscripcion(directDoc.ref, directDoc.data());
      return { idDoc: directDoc.id, ...data };
    }

    const snapshot = await db.collection("users").where("uid", "==", uid).limit(1).get();
    if (snapshot.empty) {
      console.warn(`⚠️ No se encontró usuario con UID: ${uid}`);
      return null;
    }

    const userDoc = snapshot.docs[0];
    const data = await verificarExpiracionSuscripcion(userDoc.ref, userDoc.data());
    return { idDoc: userDoc.id, ...data };
  } catch (error) {
    console.error("❌ Error en getUsuarioByUidService:", error);
    throw new Error("Error al obtener los datos del usuario");
  }
};

/**
 * Obtiene el usuario por Email normalizado
 */
export const getUsuarioByEmailService = async (email: string) => {
  try {
    const snapshotModular = await db.collection("users")
      .where("perfil.email", "==", email)
      .limit(1)
      .get();

    if (!snapshotModular.empty) {
      const userDoc = snapshotModular.docs[0];
      const data = await verificarExpiracionSuscripcion(userDoc.ref, userDoc.data());
      return { idDoc: userDoc.id, ...data };
    }

    const snapshotPlano = await db.collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshotPlano.empty) {
      console.warn(`⚠️ No se encontró usuario con email: ${email}`);
      return null;
    }

    const userDoc = snapshotPlano.docs[0];
    const data = await verificarExpiracionSuscripcion(userDoc.ref, userDoc.data());
    return { idDoc: userDoc.id, ...data };
  } catch (error) {
    console.error("❌ Error en getUsuarioByEmailService:", error);
    throw new Error("Error al verificar la existencia del email");
  }
};

/**
 * Crea un nuevo usuario con la estructura modular estricta
 */
export const crearUsuarioService = async (datos: DatosUsuario) => {
  try {
    const ahora = new Date();
    const mesActual = ahora.toISOString().slice(0, 7);
    const ahoraIso = ahora.toISOString();
    const uid = datos.uid;

    const perfil: PerfilUsuario = {
      name: datos.perfil?.name || datos.name || `User_${uid.slice(0, 6)}`,
      email: datos.perfil?.email || datos.email || "",
      photoURL: datos.perfil?.photoURL || datos.photoURL || "https://mybuckethomero2.s3.us-east-1.amazonaws.com/user/imagen.jpg",
      descripcion: datos.perfil?.descripcion || datos.descripcion || "Soy creador original de homero",
      rol: datos.perfil?.rol || datos.rol || "usuario",
      verificado: Boolean(datos.perfil?.verificado ?? datos.verificado ?? false),
      marco_perfil_id: datos.perfil?.marco_perfil_id ?? null,
    };

    const suscripciones: SuscripcionItem[] = Array.isArray(datos.suscripciones) ? datos.suscripciones : [];

    const tieneEscritor = suscripciones.some(
      (s) => (s.entitlementId.toLowerCase().includes("creador") || s.entitlementId.toLowerCase().includes("escritor")) && s.activo
    );

    const billetera: BilleteraUsuario = {
      walletBalance: Number(datos.billetera?.walletBalance ?? datos.walletBalance ?? 0),
      elevensLab: Number(datos.billetera?.elevensLab ?? datos.ElevensLab ?? (tieneEscritor ? 15 : 2)),
      mesRecargaFreeElevenLabs: mesActual,
    };

    const actividadDiaria: ActividadDiariaUsuario = {
      anunciosVistosHoy: 0,
      fechaUltimoAnuncio: "",
      dia_racha: 0,
      fechaUltimaRacha: null,
    };

    const sistema: SistemaUsuario = {
      fcmToken: datos.sistema?.fcmToken || datos.fcmToken || datos.fcm_token || "",
      ultimoDeviceId: datos.sistema?.ultimoDeviceId || datos.ultimoDeviceId || "",
      bovedaPin: datos.sistema?.bovedaPin || datos.bovedaPin || "",
      metodo: datos.sistema?.metodo || datos.metodo || "email",
      ADMIN: Boolean(datos.sistema?.ADMIN ?? (perfil.rol === "admin")),
      activo: true,
      fechaRegistro: datos.sistema?.fechaRegistro || datos.fechaRegistro || ahoraIso,
      fechaActualizacion: ahoraIso,
    };

    const nuevoDocumento: UsuarioDocumento = {
      uid,
      perfil,
      suscripciones,
      billetera,
      actividadDiaria,
      sistema,
    };

    await db.collection("users").doc(uid).set(nuevoDocumento);
    console.log(`✅ Usuario creado en formato modular. UID: ${uid}`);
    return { idDoc: uid, ...nuevoDocumento };
  } catch (error) {
    console.error("❌ Error en crearUsuarioService:", error);
    throw new Error("Error al crear el perfil del usuario en la base de datos");
  }
};

/**
 * Actualiza el nombre del usuario en perfil.name
 */
export const actualizarNombreUsuarioService = async (uid: string, nuevoNombre: string) => {
  try {
    const snapshot = await db.collection("users").where("uid", "==", uid).get();
    const docRef = snapshot.empty ? db.collection("users").doc(uid) : snapshot.docs[0].ref;
    const fechaActualizacion = new Date().toISOString();

    const updateData: Record<string, any> = {
      "perfil.name": nuevoNombre,
      "sistema.fechaActualizacion": fechaActualizacion,
      name: fieldValue.delete(),
    };

    await docRef.update(updateData);
    console.log(`Nombre actualizado a "${nuevoNombre}" para UID: ${uid}`);
    return { uid, name: nuevoNombre, fechaActualizacion };
  } catch (error) {
    console.error("Error en actualizarNombreUsuarioService:", error);
    throw new Error("Error al modificar el nombre del usuario");
  }
};

/**
 * Actualiza la descripción del usuario en perfil.descripcion
 */
export const actualizarDescripcionUsuarioService = async (uid: string, nuevaDescripcion: string) => {
  try {
    const snapshot = await db.collection("users").where("uid", "==", uid).get();
    const docRef = snapshot.empty ? db.collection("users").doc(uid) : snapshot.docs[0].ref;
    const fechaActualizacion = new Date().toISOString();

    const updateData: Record<string, any> = {
      "perfil.descripcion": nuevaDescripcion,
      "sistema.fechaActualizacion": fechaActualizacion,
      descripcion: fieldValue.delete(),
    };

    await docRef.update(updateData);
    console.log(`Descripción actualizada para UID: ${uid}`);
    return { uid, descripcion: nuevaDescripcion, fechaActualizacion };
  } catch (error) {
    console.error("Error en actualizarDescripcionUsuarioService:", error);
    throw new Error("Error al modificar la descripción del usuario");
  }
};

/**
 * Actualiza la foto del usuario en perfil.photoURL
 */
export const actualizarFotoUsuarioService = async (uid: string, nuevaFotoURL: string) => {
  try {
    const snapshot = await db.collection("users").where("uid", "==", uid).get();
    const docRef = snapshot.empty ? db.collection("users").doc(uid) : snapshot.docs[0].ref;
    const fechaActualizacion = new Date().toISOString();

    const updateData: Record<string, any> = {
      "perfil.photoURL": nuevaFotoURL,
      "sistema.fechaActualizacion": fechaActualizacion,
      photoURL: fieldValue.delete(),
    };

    await docRef.update(updateData);
    console.log(`Foto actualizada para UID: ${uid}`);
    return { uid, photoURL: nuevaFotoURL, fechaActualizacion };
  } catch (error) {
    console.error("Error en actualizarFotoUsuarioService:", error);
    throw new Error("Error al modificar la foto del usuario");
  }
};

export interface OpcionesActualizarSuscripcion {
  uid: string;
  nuevaSuscripcion: boolean;
  verificado?: boolean;
  entitlementId?: string;
  productId?: string;
  tipo?: "lector" | "escritor" | "ambos" | string;
  fechaSuscripcion?: string | null;
  fechaVencimiento?: string | null;
  diasDuracion?: number;
  elevensLab?: number;
  planLector?: string;
  planEscritor?: string;
}

/**
 * Actualiza o renueva la suscripción de un usuario en el array modular `suscripciones`
 */
export const actualizarSuscripcionUsuarioService = async (
  uidOrParams: string | OpcionesActualizarSuscripcion,
  nuevaSuscripcionParam?: boolean,
  verificadoParam?: boolean,
  fechaSuscripcionParam: string | null = null,
  fechaVencimientoParam: string | null = null,
  diasDuracionParam: number = 30,
  elevensLabParam?: number,
) => {
  try {
    let params: OpcionesActualizarSuscripcion;
    if (typeof uidOrParams === "object") {
      params = uidOrParams;
    } else {
      params = {
        uid: uidOrParams,
        nuevaSuscripcion: Boolean(nuevaSuscripcionParam),
        verificado: verificadoParam !== undefined ? Boolean(verificadoParam) : undefined,
        fechaSuscripcion: fechaSuscripcionParam,
        fechaVencimiento: fechaVencimientoParam,
        diasDuracion: diasDuracionParam,
        elevensLab: elevensLabParam,
      };
    }

    const { uid, nuevaSuscripcion, verificado } = params;
    const tipo = (params.tipo || "escritor").toLowerCase();
    const diasDuracion = params.diasDuracion !== undefined ? Number(params.diasDuracion) : 30;

    const docDirect = await db.collection("users").doc(uid).get();
    let docRef: any = null;
    let rawUserData: any = null;

    if (docDirect.exists) {
      docRef = docDirect.ref;
      rawUserData = docDirect.data();
    } else {
      const snap = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (snap.empty) {
        throw new Error(`No se encontró ningún usuario con UID: ${uid}`);
      }
      docRef = snap.docs[0].ref;
      rawUserData = snap.docs[0].data();
    }

    const usuario = normalizarUsuarioDoc(rawUserData, uid);
    const ahora = new Date();
    const ahoraIso = ahora.toISOString();
    const mesActual = ahoraIso.slice(0, 7);

    let finalFechaVencimiento = params.fechaVencimiento;
    if (nuevaSuscripcion && !finalFechaVencimiento && diasDuracion > 0) {
      const venc = new Date(ahora.getTime() + diasDuracion * 24 * 60 * 60 * 1000);
      finalFechaVencimiento = venc.toISOString();
    }
    const finalFechaSuscripcion = params.fechaSuscripcion || (nuevaSuscripcion ? ahoraIso : null);

    const currentSuscripciones: SuscripcionItem[] = [...(usuario.suscripciones || [])];
    const targetEntitlementId = params.entitlementId || (tipo === "lector" ? "lector_vip" : "creador_estelar");
    const targetProductId = params.productId || (tipo === "lector" ? "homero_lector_vip:lector-vip-mensual" : "homero_creador_estelar:creador-estelar-mensual");

    const idx = currentSuscripciones.findIndex(
      (s) => s.entitlementId.toLowerCase() === targetEntitlementId.toLowerCase() || (params.productId && s.productId === params.productId)
    );

    if (idx >= 0) {
      currentSuscripciones[idx] = {
        entitlementId: targetEntitlementId,
        productId: targetProductId,
        activo: nuevaSuscripcion,
        fechaSuscripcion: finalFechaSuscripcion ?? null,
        fechaVencimiento: finalFechaVencimiento ?? null,
        diasDuracion: nuevaSuscripcion ? diasDuracion : 0,
        autoRenovacion: currentSuscripciones[idx].autoRenovacion ?? false,
      };
    } else if (nuevaSuscripcion) {
      currentSuscripciones.push({
        entitlementId: targetEntitlementId,
        productId: targetProductId,
        activo: true,
        fechaSuscripcion: finalFechaSuscripcion ?? null,
        fechaVencimiento: finalFechaVencimiento ?? null,
        diasDuracion: diasDuracion,
        autoRenovacion: false,
      });
    }

    const tieneEscritor = tieneSubEscritorActiva(currentSuscripciones);
    const tieneLector = tieneSubLectorActiva(currentSuscripciones);
    const tieneActivaGlobal = tieneSubGlobalActiva(currentSuscripciones);

    const saldoElevensLab = params.elevensLab !== undefined
      ? Number(params.elevensLab)
      : (tieneEscritor ? Math.max(15, Number(usuario.billetera.elevensLab || 0)) : (usuario.billetera.elevensLab || 2));

    const updateData: Record<string, any> = {
      ...obtenerEliminacionesObsoletas(rawUserData),
      suscripciones: currentSuscripciones,
      "billetera.elevensLab": saldoElevensLab,
      "billetera.mesRecargaFreeElevenLabs": mesActual,
      "sistema.fechaActualizacion": ahoraIso,
    };

    if (verificado !== undefined) {
      updateData["perfil.verificado"] = Boolean(verificado);
    }

    if (debeRemoverMarcoPorSuscripcion(usuario.perfil.marco_perfil_id, tieneActivaGlobal, tieneEscritor, tieneLector)) {
      console.log(`🚫 Quitando marco de suscripción '${usuario.perfil.marco_perfil_id}' para usuario ${uid} (perfil.marco_perfil_id = null)`);
      usuario.perfil.marco_perfil_id = null;
      updateData["perfil.marco_perfil_id"] = null;
    }

    await docRef.update(updateData);
    console.log(`✅ Suscripción '${targetEntitlementId}' actualizada para usuario ${uid}`);

    const fcmToken = usuario.sistema.fcmToken;
    if (fcmToken) {
      enviarPushActualizarPerfil(fcmToken).catch((pushErr) => {
        console.error("⚠️ [FCM] Error push suscripción:", pushErr);
      });
    }

    return {
      uid,
      suscripciones: currentSuscripciones,
      verificado,
      billetera: {
        ...usuario.billetera,
        elevensLab: saldoElevensLab,
      },
      fechaActualizacion: ahoraIso,
    };
  } catch (error) {
    console.error("❌ Error en actualizarSuscripcionUsuarioService:", error);
    throw error;
  }
};

export interface ParametrosPrivilegiosUsuario {
  uid?: string;
  email?: string;
  suscription?: boolean;
  nuevaSuscripcion?: boolean;
  entitlementId?: string;
  productId?: string;
  tipo?: string;
  suscripciones?: SuscripcionItem[];
  verificado?: boolean;
  ADMIN?: boolean;
  admin?: boolean;
  isAdmin?: boolean;
  activo?: boolean;
  rol?: string;
  dias?: number;
  diasDuracion?: number;
  fechaSuscripcion?: string | null;
  fechaVencimiento?: string | null;
  elevensLab?: number;
  sumarElevensLab?: number;
  walletBalance?: number;
  sumarWalletBalance?: number;
}

/**
 * Asigna privilegios y actualiza únicamente los campos modulares
 */
export const asignarPrivilegiosUsuarioService = async (params: ParametrosPrivilegiosUsuario) => {
  try {
    const { uid, email } = params;
    if (!uid && !email) {
      throw new Error("Se requiere al menos el UID o el Email del usuario");
    }

    let docRef: any = null;
    let rawUserData: any = null;

    if (uid) {
      const docDirect = await db.collection("users").doc(uid).get();
      if (docDirect.exists) {
        docRef = docDirect.ref;
        rawUserData = docDirect.data();
      } else {
        const snapshot = await db.collection("users").where("uid", "==", uid).limit(1).get();
        if (!snapshot.empty) {
          docRef = snapshot.docs[0].ref;
          rawUserData = snapshot.docs[0].data();
        }
      }
    } else if (email) {
      let snapshot = await db.collection("users").where("perfil.email", "==", email).limit(1).get();
      if (snapshot.empty) {
        snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
      }
      if (!snapshot.empty) {
        docRef = snapshot.docs[0].ref;
        rawUserData = snapshot.docs[0].data();
      }
    }

    if (!docRef || !rawUserData) {
      throw new Error(`No se encontró ningún usuario con ${uid ? `UID: ${uid}` : `Email: ${email}`}`);
    }

    const usuario = normalizarUsuarioDoc(rawUserData, uid || docRef.id);
    const ahora = new Date();
    const ahoraIso = ahora.toISOString();

    const dataActualizada: Record<string, any> = {
      ...obtenerEliminacionesObsoletas(rawUserData),
      "sistema.fechaActualizacion": ahoraIso,
    };

    // 1. Suscripción
    if (params.suscripciones && Array.isArray(params.suscripciones)) {
      dataActualizada.suscripciones = params.suscripciones;
    } else {
      const subDeseada = params.suscription ?? params.nuevaSuscripcion;
      const cantidadDias = params.dias !== undefined ? Number(params.dias) : (params.diasDuracion !== undefined ? Number(params.diasDuracion) : 30);
      const tipoSub = (params.tipo || "escritor").toLowerCase();
      const targetEntitlement = params.entitlementId || (tipoSub === "lector" ? "lector_vip" : "creador_estelar");
      const targetProduct = params.productId || (tipoSub === "lector" ? "homero_lector_vip:lector-vip-mensual" : "homero_creador_estelar:creador-estelar-mensual");

    if (subDeseada !== undefined) {
      const activa = Boolean(subDeseada);
      const fechaInicio = params.fechaSuscripcion || (activa ? ahoraIso : null);
      let fechaVenc = params.fechaVencimiento;
      if (activa && !fechaVenc && cantidadDias > 0) {
        const v = new Date(ahora.getTime() + cantidadDias * 24 * 60 * 60 * 1000);
        fechaVenc = v.toISOString();
      } else if (!activa) {
        fechaVenc = null;
      }

      const currentSubs: SuscripcionItem[] = [...(usuario.suscripciones || [])];
      const idx = currentSubs.findIndex(
        (s) => s.entitlementId.toLowerCase() === targetEntitlement.toLowerCase()
      );

      if (idx >= 0) {
        currentSubs[idx].activo = activa;
        currentSubs[idx].fechaSuscripcion = fechaInicio ?? null;
        currentSubs[idx].fechaVencimiento = fechaVenc ?? null;
        currentSubs[idx].diasDuracion = activa ? cantidadDias : 0;
      } else if (activa) {
        currentSubs.push({
          entitlementId: targetEntitlement,
          productId: targetProduct,
          activo: true,
          fechaSuscripcion: fechaInicio ?? null,
          fechaVencimiento: fechaVenc ?? null,
          diasDuracion: cantidadDias,
          autoRenovacion: false,
        });
      }

        dataActualizada.suscripciones = currentSubs;
      }
    }

    // 2. Verificación
    if (params.verificado !== undefined) {
      dataActualizada["perfil.verificado"] = Boolean(params.verificado);
    }

    // 3. ADMIN / Rol
    const esAdmin = params.ADMIN !== undefined || params.admin !== undefined || params.isAdmin !== undefined
      ? Boolean(params.ADMIN ?? params.admin ?? params.isAdmin)
      : (params.rol ? params.rol.trim().toLowerCase() === "admin" : undefined);

    if (esAdmin !== undefined) {
      dataActualizada["sistema.ADMIN"] = esAdmin;
      if (esAdmin) {
        dataActualizada["perfil.rol"] = "admin";
      }
    }

    if (params.rol !== undefined && params.rol.trim() !== "") {
      dataActualizada["perfil.rol"] = params.rol.trim();
    }

    // 4. Activo
    if (params.activo !== undefined) {
      dataActualizada["sistema.activo"] = Boolean(params.activo);
    }

    // 5. Saldo ElevenLabs
    if (params.elevensLab !== undefined) {
      dataActualizada["billetera.elevensLab"] = Number(params.elevensLab);
    } else if (params.sumarElevensLab !== undefined) {
      const nuevoSaldo = Math.max(0, Number(usuario.billetera.elevensLab || 0) + Number(params.sumarElevensLab));
      dataActualizada["billetera.elevensLab"] = nuevoSaldo;
    }

    // 6. Saldo Monedas
    if (params.walletBalance !== undefined) {
      dataActualizada["billetera.walletBalance"] = Number(params.walletBalance);
    } else if (params.sumarWalletBalance !== undefined) {
      const nuevoSaldo = Math.max(0, Number(usuario.billetera.walletBalance || 0) + Number(params.sumarWalletBalance));
      dataActualizada["billetera.walletBalance"] = nuevoSaldo;
    }

    // Verificar si se debe retirar marco de perfil tras cambio de privilegios/suscripciones
    const finalSubs = dataActualizada.suscripciones || usuario.suscripciones || [];
    const tieneEscritorPriv = tieneSubEscritorActiva(finalSubs);
    const tieneLectorPriv = tieneSubLectorActiva(finalSubs);
    const tieneActivasPriv = tieneSubGlobalActiva(finalSubs);

    if (debeRemoverMarcoPorSuscripcion(usuario.perfil.marco_perfil_id, tieneActivasPriv, tieneEscritorPriv, tieneLectorPriv)) {
      console.log(`🚫 Quitando marco de suscripción '${usuario.perfil.marco_perfil_id}' para usuario ${usuario.uid} en asignarPrivilegiosUsuarioService`);
      usuario.perfil.marco_perfil_id = null;
      dataActualizada["perfil.marco_perfil_id"] = null;
    }

    await docRef.update(dataActualizada);
    console.log(`✅ Privilegios actualizados de forma limpia para usuario ${usuario.uid}`);

    const fcmToken = usuario.sistema.fcmToken;
    if (fcmToken) {
      enviarPushActualizarPerfil(fcmToken).catch((err) => {
        console.error("⚠️ [FCM] Error push privilegios:", err);
      });
    }

    return {
      idDoc: docRef.id,
      uid: usuario.uid,
      ...dataActualizada,
    };
  } catch (error) {
    console.error("❌ Error en asignarPrivilegiosUsuarioService:", error);
    throw error;
  }
};

/**
 * Guarda el token FCM ÚNICAMENTE en `sistema.fcmToken`
 */
export const guardarFcmTokenService = async (uid: string, fcmToken: string) => {
  try {
    const fechaActualizacion = new Date().toISOString();
    const userDocRef = db.collection("users").doc(uid);
    const docSnap = await userDocRef.get();

    const tokenData: Record<string, any> = {
      "sistema.fcmToken": fcmToken,
      "sistema.fechaActualizacion": fechaActualizacion,
      fcmToken: fieldValue.delete(),
      fcm_token: fieldValue.delete(),
      tokenActualizadoEn: fieldValue.delete(),
      "sistema.fcm_token": fieldValue.delete(),
      "sistema.tokenActualizadoEn": fieldValue.delete(),
    };

    if (docSnap.exists) {
      await userDocRef.update(tokenData);
    } else {
      const snapshot = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update(tokenData);
      } else {
        await userDocRef.set({
          uid,
          sistema: {
            fcmToken,
            fechaActualizacion,
          },
        }, { merge: true });
      }
    }

    console.log(`✅ Token FCM guardado únicamente en sistema.fcmToken para usuario: ${uid}`);
    return {
      uid,
      fcmToken,
      fechaActualizacion,
    };
  } catch (error) {
    console.error("❌ Error en guardarFcmTokenService:", error);
    throw new Error("Error al guardar el FCM token");
  }
};

export interface ParametrosMarcoUsuario {
  userId?: string;
  uid?: string;
  marco_perfil_id?: string | number | null;
  selectedFrame?: string | number | null;
  frame?: {
    id?: string | number;
    [key: string]: any;
  };
}

/**
 * Actualiza el marco de perfil únicamente en `perfil.marco_perfil_id`
 */
export const actualizarMarcoUsuarioService = async (params: ParametrosMarcoUsuario) => {
  try {
    const userId = params.userId || params.uid;
    if (!userId) {
      throw new Error("El ID de usuario (userId o uid) es requerido");
    }

    const marcoPerfilId = params.frame?.id ?? params.marco_perfil_id ?? params.selectedFrame ?? null;
    const finalMarcoId = marcoPerfilId ? String(marcoPerfilId) : null;
    const fechaActualizacion = new Date().toISOString();

    const dataToUpdate: Record<string, any> = {
      "perfil.marco_perfil_id": finalMarcoId,
      "sistema.fechaActualizacion": fechaActualizacion,
      marco_perfil_id: fieldValue.delete(),
      marco_perfil: fieldValue.delete(),
      selectedFrame: fieldValue.delete(),
    };

    const userDocRef = db.collection("users").doc(userId);
    const docSnap = await userDocRef.get();
    let fcmToken: string | null = null;

    if (docSnap.exists) {
      const userData = docSnap.data();
      fcmToken = userData?.sistema?.fcmToken || null;
      if (finalMarcoId && esMarcoDeSuscripcion(finalMarcoId)) {
        const usuarioNorm = normalizarUsuarioDoc(userData, userId);
        const tieneEscritor = tieneSubEscritorActiva(usuarioNorm.suscripciones);
        const tieneLector = tieneSubLectorActiva(usuarioNorm.suscripciones);
        const tieneActivas = tieneSubGlobalActiva(usuarioNorm.suscripciones);
        if (debeRemoverMarcoPorSuscripcion(finalMarcoId, tieneActivas, tieneEscritor, tieneLector)) {
          throw new Error("No tienes una suscripción activa correspondiente para usar este marco");
        }
      }
      await userDocRef.update(dataToUpdate);
    } else {
      const snapshot = await db.collection("users").where("uid", "==", userId).limit(1).get();
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        fcmToken = userData?.sistema?.fcmToken || null;
        if (finalMarcoId && esMarcoDeSuscripcion(finalMarcoId)) {
          const usuarioNorm = normalizarUsuarioDoc(userData, userId);
          const tieneEscritor = tieneSubEscritorActiva(usuarioNorm.suscripciones);
          const tieneLector = tieneSubLectorActiva(usuarioNorm.suscripciones);
          const tieneActivas = tieneSubGlobalActiva(usuarioNorm.suscripciones);
          if (debeRemoverMarcoPorSuscripcion(finalMarcoId, tieneActivas, tieneEscritor, tieneLector)) {
            throw new Error("No tienes una suscripción activa correspondiente para usar este marco");
          }
        }
        await snapshot.docs[0].ref.update(dataToUpdate);
      } else {
        if (finalMarcoId && esMarcoDeSuscripcion(finalMarcoId)) {
          throw new Error("No tienes una suscripción activa correspondiente para usar este marco");
        }
        await userDocRef.set({
          uid: userId,
          perfil: { marco_perfil_id: finalMarcoId },
          sistema: { fechaActualizacion },
        }, { merge: true });
      }
    }

    console.log(`✅ Marco actualizado en perfil.marco_perfil_id para usuario: ${userId} -> ${finalMarcoId}`);

    if (fcmToken) {
      enviarPushActualizarPerfil(fcmToken).catch((err) => {
        console.error("⚠️ [FCM] Error push marco:", err);
      });
    }

    return {
      userId,
      uid: userId,
      marco_perfil_id: finalMarcoId,
      fechaActualizacion,
    };
  } catch (error) {
    console.error("❌ Error en actualizarMarcoUsuarioService:", error);
    throw error;
  }
};

/**
 * Actualiza el día de racha únicamente en `actividadDiaria.dia_racha`
 */
export const actualizarDiaRachaUsuarioService = async (
  uid: string,
  diaRacha?: number,
  incrementar: boolean = false,
) => {
  try {
    if (!uid) {
      throw new Error("El UID del usuario es requerido");
    }

    const fechaActualizacion = new Date().toISOString();
    let docRef: any = null;
    let userData: any = null;

    const userDocDirect = await db.collection("users").doc(uid).get();
    if (userDocDirect.exists) {
      docRef = userDocDirect.ref;
      userData = userDocDirect.data();
    } else {
      const snapshot = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (!snapshot.empty) {
        docRef = snapshot.docs[0].ref;
        userData = snapshot.docs[0].data();
      }
    }

    if (!docRef) {
      throw new Error(`No se encontró usuario con UID: ${uid}`);
    }

    const rachaActual = Number(userData?.actividadDiaria?.dia_racha ?? userData?.dia_racha ?? 0);
    let nuevoDiaRacha: number;

    if (diaRacha !== undefined && !isNaN(Number(diaRacha)) && !incrementar) {
      nuevoDiaRacha = Math.max(0, Number(diaRacha));
    } else {
      nuevoDiaRacha = rachaActual + 1;
    }

    const dataToUpdate = {
      "actividadDiaria.dia_racha": nuevoDiaRacha,
      "actividadDiaria.fechaUltimaRacha": fechaActualizacion,
      "sistema.fechaActualizacion": fechaActualizacion,
      dia_racha: fieldValue.delete(),
      fechaUltimaRacha: fieldValue.delete(),
    };

    await docRef.update(dataToUpdate);
    console.log(`🔥 Racha guardada en actividadDiaria para usuario ${uid}: ${nuevoDiaRacha} días`);

    return {
      uid,
      dia_racha: nuevoDiaRacha,
      fechaUltimaRacha: fechaActualizacion,
      fechaActualizacion,
    };
  } catch (error) {
    console.error("❌ Error en actualizarDiaRachaUsuarioService:", error);
    throw error;
  }
};

/**
 * Obtiene el día de racha de un usuario
 */
export const obtenerDiaRachaUsuarioService = async (uid: string) => {
  try {
    if (!uid) {
      throw new Error("El UID del usuario es requerido");
    }

    let userData: any = null;
    const userDocDirect = await db.collection("users").doc(uid).get();
    if (userDocDirect.exists) {
      userData = userDocDirect.data();
    } else {
      const snapshot = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (!snapshot.empty) {
        userData = snapshot.docs[0].data();
      }
    }

    if (!userData) {
      throw new Error(`No se encontró usuario con UID: ${uid}`);
    }

    const diaRacha = Number(userData?.actividadDiaria?.dia_racha ?? userData?.dia_racha ?? 0);
    const fechaUltimaRacha = userData?.actividadDiaria?.fechaUltimaRacha || userData?.fechaUltimaRacha || null;

    return {
      uid,
      dia_racha: diaRacha,
      fechaUltimaRacha,
    };
  } catch (error) {
    console.error("❌ Error en obtenerDiaRachaUsuarioService:", error);
    throw error;
  }
};

/**
 * Descuenta 1 crédito de ElevenLabs únicamente en `billetera.elevensLab`
 */
export const descontarUsoElevenLabsService = async (uid: string) => {
  try {
    if (!uid) {
      throw new Error("El UID del usuario es requerido");
    }

    let docRef: any = null;
    let rawUserData: any = null;

    const userDocDirect = await db.collection("users").doc(uid).get();
    if (userDocDirect.exists) {
      docRef = userDocDirect.ref;
      rawUserData = userDocDirect.data();
    } else {
      const snapshot = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (!snapshot.empty) {
        docRef = snapshot.docs[0].ref;
        rawUserData = snapshot.docs[0].data();
      }
    }

    if (!docRef || !rawUserData) {
      throw new Error(`Usuario no encontrado con UID: ${uid}`);
    }

    const userNormalized = await verificarExpiracionSuscripcion(docRef, rawUserData);
    const saldoActual = Number(userNormalized.billetera?.elevensLab ?? 0);

    if (saldoActual <= 0) {
      return {
        success: false,
        permitido: false,
        saldoRestante: 0,
        mensaje: "Has alcanzado el límite de usos de ElevenLabs para este mes.",
      };
    }

    const nuevoSaldo = Math.max(0, saldoActual - 1);
    const ahoraIso = new Date().toISOString();

    await docRef.update({
      "billetera.elevensLab": nuevoSaldo,
      "sistema.fechaActualizacion": ahoraIso,
      ElevensLab: fieldValue.delete(),
    });

    console.log(`🎙️ Saldo ElevenLabs actualizado en billetera para usuario ${uid}. Saldo restante: ${nuevoSaldo}`);

    return {
      success: true,
      permitido: true,
      saldoRestante: nuevoSaldo,
      mensaje: "Uso de ElevenLabs descontado correctamente",
    };
  } catch (error) {
    console.error("❌ Error en descontarUsoElevenLabsService:", error);
    throw error;
  }
};

/**
 * Migra y limpia TODOS los usuarios en la colección "users" de Firestore
 * Eliminando absolutamente todos los campos raíz y dejando la estructura modular limpia.
 */
export const migrarTodosLosUsuariosService = async () => {
  try {
    const snapshot = await db.collection("users").get();
    console.log(`🔄 Iniciando limpieza y migración total de ${snapshot.size} usuarios al formato modular limpio...`);

    let migrados = 0;
    for (const doc of snapshot.docs) {
      const rawData = doc.data();
      const normalizado = normalizarUsuarioDoc(rawData, doc.id);

      // set con merge: false sobreescribe el documento entero sin dejar campos fantasma en la raíz
      await doc.ref.set(normalizado);
      migrados++;
    }

    console.log(`✅ Migración completada exitosamente. ${migrados} usuarios limpiados.`);
    return {
      success: true,
      totalMigrados: migrados,
      mensaje: `${migrados} usuarios migrados y limpiados exitosamente a la estructura modular`,
    };
  } catch (error) {
    console.error("❌ Error en migrarTodosLosUsuariosService:", error);
    throw new Error("Error durante la migración de usuarios");
  }
};

// ============================================================================
// CRUD DE SUSCRIPCIONES (EXCLUSIVAMENTE EN EL ARRAY `suscripciones`)
// ============================================================================

export interface ParametrosCrearSuscripcion {
  uid: string;
  entitlementId: string;
  productId?: string;
  diasDuracion?: number;
  fechaSuscripcion?: string | null;
  fechaVencimiento?: string | null;
  autoRenovacion?: boolean;
  verificado?: boolean;
  elevensLab?: number;
}

export interface ParametrosEditarSuscripcion {
  uid: string;
  entitlementId: string;
  activo?: boolean;
  productId?: string;
  diasDuracion?: number;
  fechaSuscripcion?: string | null;
  fechaVencimiento?: string | null;
  autoRenovacion?: boolean;
  verificado?: boolean;
  elevensLab?: number;
}

/**
 * Obtiene las suscripciones del usuario consultando el array `suscripciones`
 */
export const obtenerSuscripcionesUsuarioService = async (uid: string) => {
  try {
    if (!uid) {
      throw new Error("El UID del usuario es requerido");
    }

    const usuario = await getUsuarioByUidService(uid);
    if (!usuario) {
      throw new Error(`No se encontró ningún usuario con UID: ${uid}`);
    }

    const suscripciones: SuscripcionItem[] = usuario.suscripciones || [];
    const lectorSub = suscripciones.find((s) => s.entitlementId.toLowerCase().includes("lector"));
    const escritorSub = suscripciones.find((s) =>
      s.entitlementId.toLowerCase().includes("creador") ||
      s.entitlementId.toLowerCase().includes("escritor") ||
      s.entitlementId.toLowerCase().includes("estelar")
    );

    const activas = suscripciones.filter((s) => s.activo === true);
    const tieneLector = Boolean(lectorSub?.activo);
    const tieneEscritor = Boolean(escritorSub?.activo);
    const activoGlobal = activas.length > 0;

    const tipo = (tieneLector && tieneEscritor)
      ? "ambos"
      : tieneLector
      ? "lector"
      : tieneEscritor
      ? "escritor"
      : (activoGlobal ? "general" : "ninguno");

    return {
      uid: usuario.uid,
      suscripciones,
      resumen: {
        activoGlobal,
        tipo,
        tieneLector,
        tieneEscritor,
        totalSuscripciones: suscripciones.length,
        totalActivas: activas.length,
        suscripcionesActivas: activas,
      },
    };
  } catch (error) {
    console.error("❌ Error en obtenerSuscripcionesUsuarioService:", error);
    throw error;
  }
};

/**
 * Agrega o activa una suscripción en el array `suscripciones`
 */
export const agregarSuscripcionUsuarioService = async (params: ParametrosCrearSuscripcion) => {
  try {
    const { uid, entitlementId } = params;
    if (!uid || !entitlementId) {
      throw new Error("Se requieren los campos 'uid' y 'entitlementId'");
    }

    const docDirect = await db.collection("users").doc(uid).get();
    let docRef: any = null;
    let rawUserData: any = null;

    if (docDirect.exists) {
      docRef = docDirect.ref;
      rawUserData = docDirect.data();
    } else {
      const snap = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (snap.empty) {
        throw new Error(`No se encontró usuario con UID: ${uid}`);
      }
      docRef = snap.docs[0].ref;
      rawUserData = snap.docs[0].data();
    }

    const usuario = normalizarUsuarioDoc(rawUserData, uid);
    const ahora = new Date();
    const ahoraIso = ahora.toISOString();
    const mesActual = ahoraIso.slice(0, 7);

    const dias = params.diasDuracion !== undefined ? Number(params.diasDuracion) : 30;
    const fechaInicio = params.fechaSuscripcion || ahoraIso;

    let fechaVenc = params.fechaVencimiento;
    if (!fechaVenc && dias > 0) {
      const vencDate = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);
      fechaVenc = vencDate.toISOString();
    }

    const defaultProductId = entitlementId.toLowerCase().includes("lector")
      ? "homero_lector_vip:lector-vip-mensual"
      : entitlementId.toLowerCase().includes("creador") || entitlementId.toLowerCase().includes("estelar")
      ? "homero_creador_estelar:creador-estelar-mensual"
      : `homero_${entitlementId}:mensual`;

    const productId = params.productId || defaultProductId;
    const currentSubs: SuscripcionItem[] = [...(usuario.suscripciones || [])];

    const idx = currentSubs.findIndex(
      (s) => s.entitlementId.toLowerCase() === entitlementId.toLowerCase() || (productId && s.productId === productId)
    );

    const nuevaSubItem: SuscripcionItem = {
      entitlementId,
      productId,
      activo: true,
      fechaSuscripcion: fechaInicio,
      fechaVencimiento: fechaVenc || null,
      diasDuracion: dias,
      autoRenovacion: Boolean(params.autoRenovacion ?? false),
    };

    if (idx >= 0) {
      currentSubs[idx] = nuevaSubItem;
    } else {
      currentSubs.push(nuevaSubItem);
    }

    const lectorActivo = tieneSubLectorActiva(currentSubs);
    const escritorActivo = tieneSubEscritorActiva(currentSubs);
    const globalActivo = tieneSubGlobalActiva(currentSubs);

    const tipoFinal = (lectorActivo && escritorActivo)
      ? "ambos"
      : lectorActivo
      ? "lector"
      : escritorActivo
      ? "escritor"
      : (globalActivo ? "general" : "ninguno");

    const saldoElevensLab = params.elevensLab !== undefined
      ? Number(params.elevensLab)
      : (escritorActivo ? Math.max(15, Number(usuario.billetera.elevensLab || 0)) : (usuario.billetera.elevensLab || 2));

    const verificado = params.verificado !== undefined ? Boolean(params.verificado) : true;

    const updateData: Record<string, any> = {
      ...obtenerEliminacionesObsoletas(rawUserData),
      suscripciones: currentSubs,
      "billetera.elevensLab": saldoElevensLab,
      "billetera.mesRecargaFreeElevenLabs": mesActual,
      "sistema.fechaActualizacion": ahoraIso,
    };

    if (params.verificado !== undefined) {
      updateData["perfil.verificado"] = Boolean(params.verificado);
    }

    if (debeRemoverMarcoPorSuscripcion(usuario.perfil.marco_perfil_id, globalActivo, escritorActivo, lectorActivo)) {
      console.log(`🚫 Quitando marco de suscripción '${usuario.perfil.marco_perfil_id}' para usuario ${uid} (perfil.marco_perfil_id = null)`);
      usuario.perfil.marco_perfil_id = null;
      updateData["perfil.marco_perfil_id"] = null;
    }

    await docRef.update(updateData);
    console.log(`✅ Suscripción '${entitlementId}' agregada al array modular para usuario ${uid}`);

    const token = usuario.sistema.fcmToken;
    if (token) {
      enviarPushActualizarPerfil(token).catch((err) =>
        console.error("⚠️ [FCM] Error push suscripción:", err)
      );
    }

    return {
      uid,
      suscripcionAgregada: nuevaSubItem,
      suscripciones: currentSubs,
      resumen: {
        activoGlobal: globalActivo,
        tipo: tipoFinal,
        tieneLector: lectorActivo,
        tieneEscritor: escritorActivo,
      },
    };
  } catch (error) {
    console.error("❌ Error en agregarSuscripcionUsuarioService:", error);
    throw error;
  }
};

/**
 * Edita una suscripción específica dentro del array `suscripciones`
 */
export const editarSuscripcionUsuarioService = async (params: ParametrosEditarSuscripcion) => {
  try {
    const { uid, entitlementId } = params;
    if (!uid || !entitlementId) {
      throw new Error("Se requieren los campos 'uid' y 'entitlementId'");
    }

    const docDirect = await db.collection("users").doc(uid).get();
    let docRef: any = null;
    let rawUserData: any = null;

    if (docDirect.exists) {
      docRef = docDirect.ref;
      rawUserData = docDirect.data();
    } else {
      const snap = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (snap.empty) {
        throw new Error(`No se encontró usuario con UID: ${uid}`);
      }
      docRef = snap.docs[0].ref;
      rawUserData = snap.docs[0].data();
    }

    const usuario = normalizarUsuarioDoc(rawUserData, uid);
    const ahora = new Date();
    const ahoraIso = ahora.toISOString();
    const mesActual = ahoraIso.slice(0, 7);

    const currentSubs: SuscripcionItem[] = [...(usuario.suscripciones || [])];
    const idLower = entitlementId.toLowerCase().trim();
    let idx = currentSubs.findIndex(
      (s) => s.entitlementId.toLowerCase() === idLower || (params.productId && s.productId === params.productId)
    );

    if (idx === -1) {
      if (idLower.includes("creador") || idLower.includes("escritor") || idLower.includes("estelar")) {
        idx = currentSubs.findIndex((s) => {
          const sId = (s.entitlementId || "").toLowerCase();
          const pId = (s.productId || "").toLowerCase();
          return sId.includes("creador") || sId.includes("escritor") || sId.includes("estelar") || pId.includes("creador") || pId.includes("escritor");
        });
      } else if (idLower.includes("lector") || idLower.includes("vip") || idLower.includes("reader")) {
        idx = currentSubs.findIndex((s) => {
          const sId = (s.entitlementId || "").toLowerCase();
          const pId = (s.productId || "").toLowerCase();
          return sId.includes("lector") || sId.includes("vip") || sId.includes("reader") || pId.includes("lector") || pId.includes("reader");
        });
      }
    }

    if (idx === -1) {
      if (params.activo === false) {
        return {
          uid,
          suscripcionEditada: null,
          suscripciones: currentSubs,
          resumen: {
            activoGlobal: tieneSubGlobalActiva(currentSubs),
            tipo: "ninguno",
            tieneLector: tieneSubLectorActiva(currentSubs),
            tieneEscritor: tieneSubEscritorActiva(currentSubs),
          },
        };
      }
      throw new Error(`No se encontró la suscripción '${entitlementId}' para el usuario ${uid}`);
    }

    const existing = currentSubs[idx];
    const nuevoActivo = params.activo !== undefined ? Boolean(params.activo) : existing.activo;
    const nuevoProductId = params.productId || existing.productId;
    const nuevoDias = params.diasDuracion !== undefined ? Number(params.diasDuracion) : existing.diasDuracion;
    const nuevaFechaSuscripcion = params.fechaSuscripcion !== undefined ? params.fechaSuscripcion : existing.fechaSuscripcion;

    let nuevaFechaVencimiento = params.fechaVencimiento !== undefined ? params.fechaVencimiento : existing.fechaVencimiento;
    if (params.diasDuracion !== undefined && params.diasDuracion > 0 && params.fechaVencimiento === undefined) {
      const vencDate = new Date(ahora.getTime() + params.diasDuracion * 24 * 60 * 60 * 1000);
      nuevaFechaVencimiento = vencDate.toISOString();
    }

    const subEditada: SuscripcionItem = {
      ...existing,
      activo: nuevoActivo,
      productId: nuevoProductId,
      diasDuracion: nuevoDias,
      fechaSuscripcion: nuevaFechaSuscripcion,
      fechaVencimiento: nuevoActivo ? nuevaFechaVencimiento : (params.fechaVencimiento ?? null),
      autoRenovacion: params.autoRenovacion !== undefined ? Boolean(params.autoRenovacion) : existing.autoRenovacion,
    };

    currentSubs[idx] = subEditada;

    const lectorActivo = tieneSubLectorActiva(currentSubs);
    const escritorActivo = tieneSubEscritorActiva(currentSubs);
    const globalActivo = tieneSubGlobalActiva(currentSubs);

    const tipoFinal = (lectorActivo && escritorActivo)
      ? "ambos"
      : lectorActivo
      ? "lector"
      : escritorActivo
      ? "escritor"
      : (globalActivo ? "general" : "ninguno");

    const saldoElevensLab = params.elevensLab !== undefined
      ? Number(params.elevensLab)
      : (escritorActivo ? Math.max(15, Number(usuario.billetera.elevensLab || 0)) : (usuario.billetera.elevensLab || 2));

    const updateData: Record<string, any> = {
      ...obtenerEliminacionesObsoletas(rawUserData),
      suscripciones: currentSubs,
      "billetera.elevensLab": saldoElevensLab,
      "billetera.mesRecargaFreeElevenLabs": mesActual,
      "sistema.fechaActualizacion": ahoraIso,
    };

    if (params.verificado !== undefined) {
      updateData["perfil.verificado"] = Boolean(params.verificado);
    }

    if (debeRemoverMarcoPorSuscripcion(usuario.perfil.marco_perfil_id, globalActivo, escritorActivo, lectorActivo)) {
      console.log(`🚫 Quitando marco de suscripción '${usuario.perfil.marco_perfil_id}' para usuario ${uid} (perfil.marco_perfil_id = null)`);
      usuario.perfil.marco_perfil_id = null;
      updateData["perfil.marco_perfil_id"] = null;
    }

    await docRef.update(updateData);
    console.log(`✅ Suscripción '${entitlementId}' editada en array modular para usuario ${uid}`);

    const token = usuario.sistema.fcmToken;
    if (token) {
      enviarPushActualizarPerfil(token).catch((err: any) =>
        console.error("⚠️ [FCM] Error push edición suscripción:", err)
      );
    }

    return {
      uid,
      suscripcionEditada: subEditada,
      suscripciones: currentSubs,
      resumen: {
        activoGlobal: globalActivo,
        tipo: tipoFinal,
        tieneLector: lectorActivo,
        tieneEscritor: escritorActivo,
      },
    };
  } catch (error) {
    console.error("❌ Error en editarSuscripcionUsuarioService:", error);
    throw error;
  }
};

/**
 * Elimina una suscripción del array `suscripciones`
 */
export const eliminarSuscripcionUsuarioService = async (
  uid: string,
  entitlementId: string,
  eliminarCompletamente: boolean = true,
) => {
  try {
    if (!uid || !entitlementId) {
      throw new Error("Se requieren los campos 'uid' y 'entitlementId'");
    }

    const docDirect = await db.collection("users").doc(uid).get();
    let docRef: any = null;
    let rawUserData: any = null;

    if (docDirect.exists) {
      docRef = docDirect.ref;
      rawUserData = docDirect.data();
    } else {
      const snap = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (snap.empty) {
        throw new Error(`No se encontró usuario con UID: ${uid}`);
      }
      docRef = snap.docs[0].ref;
      rawUserData = snap.docs[0].data();
    }

    const usuario = normalizarUsuarioDoc(rawUserData, uid);
    const ahora = new Date();
    const ahoraIso = ahora.toISOString();
    const mesActual = ahoraIso.slice(0, 7);

    let currentSubs: SuscripcionItem[] = [...(usuario.suscripciones || [])];
    const idLower = entitlementId.toLowerCase().trim();

    // 1. Buscar coincidencia exacta o por alias/tipo
    const matchedIndices: number[] = [];
    currentSubs.forEach((s, idx) => {
      const sId = (s.entitlementId || "").toLowerCase();
      const pId = (s.productId || "").toLowerCase();
      if (sId === idLower || (pId && pId === idLower)) {
        matchedIndices.push(idx);
      } else if (
        (idLower.includes("creador") || idLower.includes("escritor") || idLower.includes("estelar")) &&
        (sId.includes("creador") || sId.includes("escritor") || sId.includes("estelar") || pId.includes("creador") || pId.includes("escritor"))
      ) {
        matchedIndices.push(idx);
      } else if (
        (idLower.includes("lector") || idLower.includes("vip") || idLower.includes("reader")) &&
        (sId.includes("lector") || sId.includes("vip") || sId.includes("reader") || pId.includes("lector") || pId.includes("reader"))
      ) {
        matchedIndices.push(idx);
      }
    });

    const existiaSuscripcion = matchedIndices.length > 0;

    if (existiaSuscripcion) {
      if (eliminarCompletamente) {
        currentSubs = currentSubs.filter((_, idx) => !matchedIndices.includes(idx));
      } else {
        matchedIndices.forEach((idx) => {
          currentSubs[idx].activo = false;
          currentSubs[idx].fechaVencimiento = ahoraIso;
        });
      }
    }

    const lectorActivo = tieneSubLectorActiva(currentSubs);
    const escritorActivo = tieneSubEscritorActiva(currentSubs);
    const globalActivo = tieneSubGlobalActiva(currentSubs);

    const tipoFinal = (lectorActivo && escritorActivo)
      ? "ambos"
      : lectorActivo
      ? "lector"
      : escritorActivo
      ? "escritor"
      : (globalActivo ? "general" : "ninguno");

    const updateData: Record<string, any> = {
      ...obtenerEliminacionesObsoletas(rawUserData),
      suscripciones: currentSubs,
      "sistema.fechaActualizacion": ahoraIso,
    };

    if (debeRemoverMarcoPorSuscripcion(usuario.perfil.marco_perfil_id, globalActivo, escritorActivo, lectorActivo)) {
      console.log(`🚫 Quitando marco de suscripción '${usuario.perfil.marco_perfil_id}' para usuario ${uid} (perfil.marco_perfil_id = null)`);
      usuario.perfil.marco_perfil_id = null;
      updateData["perfil.marco_perfil_id"] = null;
    }

    if (!escritorActivo) {
      updateData["billetera.elevensLab"] = 2;
      updateData["billetera.mesRecargaFreeElevenLabs"] = mesActual;
    }

    await docRef.update(updateData);
    console.log(`🗑️ Suscripción '${entitlementId}' procesada/eliminada para usuario ${uid}`);

    const token = usuario.sistema.fcmToken;
    if (token) {
      enviarPushActualizarPerfil(token).catch((err) =>
        console.error("⚠️ [FCM] Error push eliminación suscripción:", err)
      );
    }

    return {
      success: true,
      mensaje: existiaSuscripcion
        ? `Suscripción '${entitlementId}' eliminada correctamente`
        : `El usuario ya no poseía la suscripción '${entitlementId}' activa`,
      uid,
      entitlementId,
      suscripcionesRestantes: currentSubs,
      resumen: {
        activoGlobal: globalActivo,
        tipo: tipoFinal,
        tieneLector: lectorActivo,
        tieneEscritor: escritorActivo,
      },
    };
  } catch (error) {
    console.error("❌ Error en eliminarSuscripcionUsuarioService:", error);
    throw error;
  }
};
