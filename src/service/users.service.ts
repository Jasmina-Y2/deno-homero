import { db, fieldValue } from "../config/firebase.ts";
import { DatosUsuario } from "../models/users.model.ts";
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
      try {
        await docRef.update({
          suscription: false,
          ElevensLab: 0,
          fechaActualizacion: ahora.toISOString(),
        });
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

    const ahora = new Date();
    const fechaActualizacion = ahora.toISOString();
    const elevensLabFinal = nuevaSuscripcion ? elevensLab : 0;
    const finalFechaSuscripcion = fechaSuscripcion || (nuevaSuscripcion ? ahora.toISOString() : null);

    let finalFechaVencimiento = fechaVencimiento;
    if (nuevaSuscripcion && !fechaVencimiento && diasDuracion && diasDuracion > 0) {
      const venc = new Date(ahora.getTime() + Number(diasDuracion) * 24 * 60 * 60 * 1000);
      finalFechaVencimiento = venc.toISOString();
    }

    const dataActualizada = {
      suscription: nuevaSuscripcion,
      verificado: verificado,
      ElevensLab: elevensLabFinal,
      fechaActualizacion: fechaActualizacion,
      fechaSuscripcion: finalFechaSuscripcion,
      fechaVencimiento: finalFechaVencimiento,
      diasDuracion: nuevaSuscripcion ? diasDuracion : 0,
    };

    const promesas = snapshot.docs.map((doc) => {
      return doc.ref.update(dataActualizada);
    });

    await Promise.all(promesas);

    console.log(
      `Suscripción actualizada a "${nuevaSuscripcion}" para UID: ${uid}. ElevensLab: ${elevensLabFinal}. Vencimiento: ${finalFechaVencimiento}`,
    );

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
 * - Rol de Administrador ("admin" / "usuario")
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

    // 2. Manejo de Verificación
    if (verificado !== undefined) {
      dataActualizada.verificado = Boolean(verificado);
    }

    // 3. Manejo de Rol (admin / usuario)
    if (rol !== undefined && typeof rol === "string" && rol.trim() !== "") {
      dataActualizada.rol = rol.trim().toLowerCase();
    }

    // 4. Manejo de saldo de ElevensLab
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

    if (docSnap.exists) {
      await userDocRef.update({
        fcmToken: fcmToken,
        tokenActualizadoEn: fechaActualizacion,
        fechaActualizacion: fechaActualizacion,
      });
    } else {
      const snapshot = await db.collection("users").where("uid", "==", uid).get();
      if (!snapshot.empty) {
        const promesas = snapshot.docs.map((doc) =>
          doc.ref.update({
            fcmToken: fcmToken,
            tokenActualizadoEn: fechaActualizacion,
            fechaActualizacion: fechaActualizacion,
          })
        );
        await Promise.all(promesas);
      } else {
        await userDocRef.set({
          uid: uid,
          fcmToken: fcmToken,
          tokenActualizadoEn: fechaActualizacion,
          fechaActualizacion: fechaActualizacion,
        }, { merge: true });
      }
    }

    console.log(`✅ Token FCM guardado en base de datos para usuario: ${uid}`);
    return {
      uid,
      fcmToken,
      tokenActualizadoEn: fechaActualizacion,
    };
  } catch (error) {
    console.error("❌ Error en guardarFcmTokenService:", error);
    throw new Error("Error al guardar el FCM token en la base de datos");
  }
};

