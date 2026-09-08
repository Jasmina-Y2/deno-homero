import { db, fieldValue } from "../config/firebase.ts";
import { DatosUsuario } from "../models/users.model.ts";
import { enviarPushActualizarPerfil } from "./notification.service.ts";
export const getUsuariosService = async () => {
  try {
    const snapshot = await db.collection("users").get();
    return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("❌ Error en getUsuariosService:", error);
    throw new Error("Error al obtener la lista de usuarios");
  }
};

const verificarExpiracionSuscripcion = async (docRef: any, data: any) => {
  if (data && data.suscription && data.fechaVencimiento) {
    const ahora = new Date();
    const fechaVenc = new Date(data.fechaVencimiento);
    if (ahora > fechaVenc) {
      data.suscription = false;
      data.ElevensLab = 0;

      const updateData: Record<string, any> = {
        suscription: false,
        ElevensLab: 0,
        fechaActualizacion: ahora.toISOString(),
      };

      // Si por defecto estaba con marco_perfil_id "pro_gold", ponerlo en null al expirar suscripción
      const marcoId = String(data.marco_perfil_id ?? data.selectedFrame ?? "");
      if (marcoId.toLowerCase() === "pro_gold") {
        data.marco_perfil = null;
        data.marco_perfil_id = null;
        data.selectedFrame = null;
        updateData.marco_perfil = null;
        updateData.marco_perfil_id = null;
        updateData.selectedFrame = null;
      }

      try {
        await docRef.update(updateData);
        console.log(
          `⏱️ Suscripción expirada para usuario ${data.uid || docRef.id}. Marco pro_gold removido: ${marcoId.toLowerCase() === "pro_gold"}`,
        );

        // Notificar en segundo plano mediante FCM data-only
        const fcmToken = data.fcm_token || data.fcmToken;
        if (fcmToken) {
          enviarPushActualizarPerfil(fcmToken).catch((err) =>
            console.error("⚠️ [FCM] Error al enviar ACTUALIZAR_PERFIL tras expiración de suscripción:", err)
          );
        }
      } catch (err) {
        console.error("Error al actualizar expiración de suscripción:", err);
      }
    }
  }
  return data;
};

export const getUsuarioByUidService = async (uid: string) => {
  try {
    const snapshot = await db.collection("users")
      .where("uid", "==", uid)
      .get();

    if (snapshot.empty) {
      console.warn(`⚠️ No se encontró usuario con UID: ${uid}`);
      return null;
    }

    const userDoc = snapshot.docs[0];
    const data = await verificarExpiracionSuscripcion(userDoc.ref, userDoc.data());

    return {
      idDoc: userDoc.id,
      ...data,
    };
  } catch (error) {
    console.error("❌ Error en getUsuarioByUidService:", error);
    throw new Error("Error al obtener los datos del usuario");
  }
};
export const getUsuarioByEmailService = async (email: string) => {
  try {
    const snapshot = await db.collection("users")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      console.warn(`⚠️ No se encontró usuario con el email: ${email}`);
      return null;
    }

    const userDoc = snapshot.docs[0];
    const data = await verificarExpiracionSuscripcion(userDoc.ref, userDoc.data());

    return {
      idDoc: userDoc.id,
      ...data,
    };
  } catch (error) {
    console.error("❌ Error en getUsuarioByEmailService:", error);
    throw new Error("Error al verificar la existencia del email");
  }
};
export const crearUsuarioService = async (datos: DatosUsuario) => {
  try {
    const metodoRegistro = datos.metodo || "email";

    await db.collection("users").doc(datos.uid).set({
      ...datos,
      fechaRegistro: datos.fechaRegistro || new Date().toISOString(),
      rol: "usuario",
      activo: true,
      metodo: metodoRegistro,
      suscription: false,
      verificado: false,
      ElevensLab: 0,
      fechaSuscripcion: null,
      fechaVencimiento: null,
      descripcion: "Soy creador original de homero",
    });

    console.log(
      `Usuario creado exitosamente con UID: ${datos.uid} vía ${metodoRegistro}`,
    );

    return {
      idDoc: datos.uid,
      ...datos,
      rol: "usuario",
      activo: true,
      metodo: metodoRegistro,
      suscription: false,
      verificado: false,
      ElevensLab: 0,
      fechaSuscripcion: null,
      fechaVencimiento: null,
      descripcion: "Soy creador original de homero",
    };
  } catch (error) {
    console.error("Error en crearUsuarioService:", error);
    throw new Error("Error al crear el perfil del usuario en la base de datos");
  }
};

export const actualizarNombreUsuarioService = async (
  uid: string,
  nuevoNombre: string,
) => {
  try {
    const snapshot = await db.collection("users").where("uid", "==", uid).get();
    if (snapshot.empty) {
      throw new Error(`No se encontró ningún usuario con el uid: ${uid}`);
    }
    const fechaActualizacion = new Date().toISOString();

    const promesas = snapshot.docs.map((doc) => {
      return doc.ref.update({
        name: nuevoNombre,
        fechaActualizacion: fechaActualizacion,
      });
    });

    await Promise.all(promesas);

    console.log(
      `Nombre actualizado exitosamente a "${nuevoNombre}" para el campo UID: ${uid}`,
    );

    return {
      uid: uid,
      name: nuevoNombre,
      fechaActualizacion: fechaActualizacion,
    };
  } catch (error) {
    console.error("Error en actualizarNombreUsuarioService:", error);
    throw new Error(
      "Error al modificar el nombre del usuario en la base de datos",
    );
  }
};

export const actualizarFotoUsuarioService = async (
  uid: string,
  nuevaFotoURL: string,
) => {
  try {
    const snapshot = await db.collection("users").where("uid", "==", uid).get();
    if (snapshot.empty) {
      throw new Error(`No se encontró ningún usuario con el uid: ${uid}`);
    }
    const fechaActualizacion = new Date().toISOString();

    const promesas = snapshot.docs.map((doc) => {
      return doc.ref.update({
        photoURL: nuevaFotoURL,
        fechaActualizacion: fechaActualizacion,
      });
    });

    await Promise.all(promesas);

    console.log(
      `Foto actualizada exitosamente a "${nuevaFotoURL}" para el campo UID: ${uid}`,
    );

    return {
      uid: uid,
      photoURL: nuevaFotoURL,
      fechaActualizacion: fechaActualizacion,
    };
  } catch (error) {
    console.error("Error en actualizarFotoUsuarioService:", error);
    throw new Error(
      "Error al modificar la foto del usuario en la base de datos",
    );
  }
};

export const actualizarSuscripcionUsuarioService = async (
  uid: string,
  nuevaSuscripcion: boolean,
  verificado: boolean,
  fechaSuscripcion: string | null = null,
  fechaVencimiento: string | null = null,
  diasDuracion: number = 30,
  elevensLab: number = 15,
) => {
  try {
    const snapshot = await db.collection("users").where("uid", "==", uid).get();
    if (snapshot.empty) {
      throw new Error(`No se encontró ningún usuario con el uid: ${uid}`);
    }

    const userData = snapshot.docs[0].data();
    const fcmToken = userData?.fcm_token || userData?.fcmToken || null;

    const ahora = new Date();
    const fechaActualizacion = ahora.toISOString();
    const elevensLabFinal = nuevaSuscripcion ? elevensLab : 0;
    const finalFechaSuscripcion = fechaSuscripcion || (nuevaSuscripcion ? ahora.toISOString() : null);

    let finalFechaVencimiento = fechaVencimiento;
    if (nuevaSuscripcion && !fechaVencimiento && diasDuracion && diasDuracion > 0) {
      const venc = new Date(ahora.getTime() + Number(diasDuracion) * 24 * 60 * 60 * 1000);
      finalFechaVencimiento = venc.toISOString();
    }

    const dataActualizada: Record<string, any> = {
      suscription: nuevaSuscripcion,
      verificado: verificado,
      ElevensLab: elevensLabFinal,
      fechaActualizacion: fechaActualizacion,
      fechaSuscripcion: finalFechaSuscripcion,
      fechaVencimiento: finalFechaVencimiento,
      diasDuracion: nuevaSuscripcion ? diasDuracion : 0,
    };

    // Si el usuario se queda sin suscripción y tenía el marco "pro_gold", se le quita (null)
    const marcoId = String(userData.marco_perfil_id ?? userData.selectedFrame ?? "");
    if (!nuevaSuscripcion && marcoId.toLowerCase() === "pro_gold") {
      dataActualizada.marco_perfil = null;
      dataActualizada.marco_perfil_id = null;
      dataActualizada.selectedFrame = null;
    }

    const promesas = snapshot.docs.map((doc) => {
      return doc.ref.update(dataActualizada);
    });

    await Promise.all(promesas);

    console.log(
      `Suscripción actualizada a "${nuevaSuscripcion}" para UID: ${uid}. ElevensLab: ${elevensLabFinal}. Vencimiento: ${finalFechaVencimiento}`,
    );

    // Notificar en segundo plano al dispositivo mediante FCM data-only
    if (fcmToken) {
      enviarPushActualizarPerfil(fcmToken).catch((pushErr) => {
        console.error("⚠️ [FCM] Error al enviar ACTUALIZAR_PERFIL tras actualizar suscripción:", pushErr);
      });
    }

    return {
      uid: uid,
      ...dataActualizada,
    };
  } catch (error) {
    console.error("Error en actualizarSuscripcionUsuarioService:", error);
    throw new Error(
      "Error al modificar la suscripción del usuario en la base de datos",
    );
  }
};

export interface ParametrosPrivilegiosUsuario {
  uid?: string;
  email?: string;
  suscription?: boolean;
  verificado?: boolean;
  ADMIN?: boolean;
  admin?: boolean;
  isAdmin?: boolean;
  activo?: boolean;
  rol?: "admin" | "usuario" | string;
  dias?: number;
  diasDuracion?: number;
  fechaSuscripcion?: string | null;
  fechaVencimiento?: string | null;
  elevensLab?: number;
  sumarElevensLab?: number;
}

/**
 * Asigna de forma personalizada privilegios a cualquier usuario:
 * - Suscripción por días personalizados (ej. 2 o 5 días enteros con cálculo automático de fechaVencimiento)
 * - Insignia de Verificado (true / false)
 * - Permisos de Administrador con campo booleano `ADMIN: true / false`
 * - Estado Activo / Inactivo `activo: true / false` (para desactivar o activar usuarios)
 * - Saldo de generaciones de ElevenLabs (set o suma)
 */
export const asignarPrivilegiosUsuarioService = async (
  params: ParametrosPrivilegiosUsuario,
) => {
  try {
    const {
      uid,
      email,
      suscription,
      verificado,
      ADMIN,
      admin,
      isAdmin,
      activo,
      rol,
      dias,
      diasDuracion,
      elevensLab,
      sumarElevensLab,
    } = params;

    if (!uid && !email) {
      throw new Error("Se requiere al menos el UID o el Email del usuario");
    }

    let snapshot: any;
    if (uid) {
      snapshot = await db.collection("users").where("uid", "==", uid).get();
      if (snapshot.empty) {
        const docSnap = await db.collection("users").doc(uid).get();
        if (docSnap.exists) {
          snapshot = { docs: [docSnap], empty: false };
        }
      }
    } else if (email) {
      snapshot = await db.collection("users").where("email", "==", email).get();
    }

    if (!snapshot || snapshot.empty) {
      throw new Error(
        `No se encontró ningún usuario con ${uid ? `UID: ${uid}` : `Email: ${email}`}`,
      );
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const ahora = new Date();
    const fechaActualizacion = ahora.toISOString();

    const dataActualizada: Record<string, any> = {
      fechaActualizacion,
    };

    // 1. Manejo de Suscripción y Días (ej: 2 días, 5 días, 30 días)
    const cantidadDias = dias !== undefined
      ? Number(dias)
      : (diasDuracion !== undefined ? Number(diasDuracion) : undefined);

    if (suscription !== undefined) {
      dataActualizada.suscription = Boolean(suscription);
      if (suscription) {
        const fechaInicio = params.fechaSuscripcion || ahora.toISOString();
        dataActualizada.fechaSuscripcion = fechaInicio;

        if (params.fechaVencimiento) {
          dataActualizada.fechaVencimiento = params.fechaVencimiento;
        } else if (cantidadDias !== undefined && cantidadDias > 0) {
          const fechaVenc = new Date(
            ahora.getTime() + cantidadDias * 24 * 60 * 60 * 1000,
          );
          dataActualizada.fechaVencimiento = fechaVenc.toISOString();
          dataActualizada.diasDuracion = cantidadDias;
        } else if (!userData.fechaVencimiento) {
          const fechaVenc = new Date(
            ahora.getTime() + 30 * 24 * 60 * 60 * 1000,
          );
          dataActualizada.fechaVencimiento = fechaVenc.toISOString();
          dataActualizada.diasDuracion = 30;
        }
      } else {
        dataActualizada.fechaVencimiento = null;
        dataActualizada.diasDuracion = 0;

        // Si se quita la suscripción y tenía el marco "pro_gold", se le quita (null)
        const marcoId = String(userData.marco_perfil_id ?? userData.selectedFrame ?? "");
        if (marcoId.toLowerCase() === "pro_gold") {
          dataActualizada.marco_perfil = null;
          dataActualizada.marco_perfil_id = null;
          dataActualizada.selectedFrame = null;
        }
      }
    } else if (cantidadDias !== undefined && cantidadDias > 0) {
      dataActualizada.suscription = true;
      dataActualizada.fechaSuscripcion = ahora.toISOString();
      const fechaVenc = new Date(
        ahora.getTime() + cantidadDias * 24 * 60 * 60 * 1000,
      );
      dataActualizada.fechaVencimiento = fechaVenc.toISOString();
      dataActualizada.diasDuracion = cantidadDias;
    }

    // 2. Manejo de Verificación (true / false)
    if (verificado !== undefined) {
      dataActualizada.verificado = Boolean(verificado);
    }

    // 3. Manejo de campo ADMIN Booleano en mayúscula ("ADMIN": true / false)
    if (ADMIN !== undefined || admin !== undefined || isAdmin !== undefined) {
      const valorAdmin = Boolean(ADMIN ?? admin ?? isAdmin);
      dataActualizada.ADMIN = valorAdmin;
      dataActualizada.admin = valorAdmin;
    } else if (rol !== undefined && typeof rol === "string" && rol.trim() !== "") {
      const valorAdmin = rol.trim().toLowerCase() === "admin";
      dataActualizada.ADMIN = valorAdmin;
      dataActualizada.admin = valorAdmin;
    }

    // 4. Manejo de estado Activo / Desactivado (activo: true / false)
    if (activo !== undefined) {
      dataActualizada.activo = Boolean(activo);
    }

    // 5. Manejo de saldo de ElevensLab
    if (elevensLab !== undefined) {
      dataActualizada.ElevensLab = Number(elevensLab);
    } else if (sumarElevensLab !== undefined) {
      const saldoActual = Number(userData.ElevensLab || 0);
      dataActualizada.ElevensLab = Math.max(0, saldoActual + Number(sumarElevensLab));
    } else if (suscription === true && userData.ElevensLab === undefined) {
      dataActualizada.ElevensLab = 15;
    }

    const promesas = snapshot.docs.map((doc: any) =>
      doc.ref.update(dataActualizada)
    );
    await Promise.all(promesas);

    console.log(
      `✅ Privilegios actualizados para usuario ${userData.uid || uid}:`,
      dataActualizada,
    );

    // Notificar en segundo plano al dispositivo mediante FCM data-only
    const fcmTokenPriv = userData?.fcm_token || userData?.fcmToken;
    if (fcmTokenPriv) {
      enviarPushActualizarPerfil(fcmTokenPriv).catch((pushErr) => {
        console.error("⚠️ [FCM] Error al enviar ACTUALIZAR_PERFIL tras asignar privilegios:", pushErr);
      });
    }

    return {
      idDoc: userDoc.id,
      uid: userData.uid || uid,
      email: userData.email,
      name: userData.name,
      ...userData,
      ...dataActualizada,
    };
  } catch (error) {
    console.error("❌ Error en asignarPrivilegiosUsuarioService:", error);
    throw error;
  }
};

export const actualizarDescripcionUsuarioService = async (
  uid: string,
  nuevaDescripcion: string,
) => {
  try {
    const snapshot = await db.collection("users").where("uid", "==", uid).get();
    if (snapshot.empty) {
      throw new Error(`No se encontró ningún usuario con el uid: ${uid}`);
    }
    const fechaActualizacion = new Date().toISOString();

    const promesas = snapshot.docs.map((doc) => {
      return doc.ref.update({
        descripcion: nuevaDescripcion,
        fechaActualizacion: fechaActualizacion,
      });
    });

    await Promise.all(promesas);

    console.log(
      `Descripción actualizada exitosamente a "${nuevaDescripcion}" para el campo UID: ${uid}`,
    );

    return {
      uid: uid,
      descripcion: nuevaDescripcion,
      fechaActualizacion: fechaActualizacion,
    };
  } catch (error) {
    console.error("Error en actualizarDescripcionUsuarioService:", error);
    throw new Error(
      "Error al modificar la descripción del usuario en la base de datos",
    );
  }
};

export const guardarFcmTokenService = async (
  uid: string,
  fcmToken: string,
) => {
  try {
    const fechaActualizacion = new Date().toISOString();

    const userDocRef = db.collection("users").doc(uid);
    const docSnap = await userDocRef.get();

    const tokenData = {
      fcmToken: fcmToken,
      fcm_token: fcmToken,
      tokenActualizadoEn: fechaActualizacion,
      fechaActualizacion: fechaActualizacion,
    };

    if (docSnap.exists) {
      await userDocRef.update(tokenData);
    } else {
      const snapshot = await db.collection("users").where("uid", "==", uid).get();
      if (!snapshot.empty) {
        const promesas = snapshot.docs.map((doc) =>
          doc.ref.update(tokenData)
        );
        await Promise.all(promesas);
      } else {
        await userDocRef.set({
          uid: uid,
          ...tokenData,
        }, { merge: true });
      }
    }

    console.log(`✅ Token FCM guardado en base de datos para usuario: ${uid}`);
    return {
      uid,
      fcmToken,
      fcm_token: fcmToken,
      tokenActualizadoEn: fechaActualizacion,
    };
  } catch (error) {
    console.error("❌ Error en guardarFcmTokenService:", error);
    throw new Error("Error al guardar el FCM token en la base de datos");
  }
};

export interface ParametrosMarcoUsuario {
  userId?: string;
  uid?: string;
  marco_perfil?: string;
  marco_perfil_id?: string | number;
  selectedFrame?: string | number;
  frame?: {
    id?: string | number;
    src?: string;
    [key: string]: any;
  };
}

/**
 * Actualiza o asigna el marco de perfil seleccionado de un usuario en Firestore:
 * marco_perfil: frame.src
 * marco_perfil_id: frame.id
 * selectedFrame: frame.id
 */
export const actualizarMarcoUsuarioService = async (
  params: ParametrosMarcoUsuario,
) => {
  try {
    const userId = params.userId || params.uid;
    if (!userId) {
      throw new Error("El ID de usuario (userId o uid) es requerido");
    }

    const marcoPerfil = params.frame?.src ?? params.marco_perfil ?? "";
    const marcoPerfilId = params.frame?.id ?? params.marco_perfil_id ?? params.selectedFrame ?? "";
    const selectedFrame = params.frame?.id ?? params.selectedFrame ?? params.marco_perfil_id ?? "";
    const fechaActualizacion = new Date().toISOString();

    const dataToUpdate: Record<string, any> = {
      marco_perfil: marcoPerfil,
      marco_perfil_id: marcoPerfilId,
      selectedFrame: selectedFrame,
      fechaActualizacion: fechaActualizacion,
    };

    const userDocRef = db.collection("users").doc(userId);
    const docSnap = await userDocRef.get();

    let fcmToken: string | null = null;

    if (docSnap.exists) {
      const userData = docSnap.data();
      fcmToken = userData?.fcm_token || userData?.fcmToken || null;
      await userDocRef.set(dataToUpdate, { merge: true });
    } else {
      const snapshot = await db.collection("users").where("uid", "==", userId).get();
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        fcmToken = userData?.fcm_token || userData?.fcmToken || null;
        const promesas = snapshot.docs.map((doc: any) =>
          doc.ref.set(dataToUpdate, { merge: true })
        );
        await Promise.all(promesas);
      } else {
        await userDocRef.set({
          uid: userId,
          ...dataToUpdate,
        }, { merge: true });
      }
    }

    console.log(`✅ Marco de perfil actualizado para usuario: ${userId}`, dataToUpdate);

    // Notificar en segundo plano al dispositivo mediante FCM data-only
    if (fcmToken) {
      enviarPushActualizarPerfil(fcmToken).catch((pushErr) => {
        console.error("⚠️ [FCM] Error al enviar ACTUALIZAR_PERFIL tras actualizar marco:", pushErr);
      });
    }

    return {
      userId,
      uid: userId,
      ...dataToUpdate,
    };
  } catch (error) {
    console.error("❌ Error en actualizarMarcoUsuarioService:", error);
    throw new Error(
      error instanceof Error ? error.message : "Error al actualizar el marco del perfil",
    );
  }
};


