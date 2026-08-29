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
      data.verificado = false;
      data.ElevensLab = 0;
      try {
        await docRef.update({
          suscription: false,
          verificado: false,
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

    const dataActualizada = {
      suscription: nuevaSuscripcion,
      verificado: verificado,
      ElevensLab: elevensLabFinal,
      fechaActualizacion: fechaActualizacion,
      fechaSuscripcion: fechaSuscripcion,
      fechaVencimiento: fechaVencimiento,
      diasDuracion: nuevaSuscripcion ? diasDuracion : 0,
    };

    const promesas = snapshot.docs.map((doc) => {
      return doc.ref.update(dataActualizada);
    });

    await Promise.all(promesas);

    console.log(
      `Suscripción actualizada a "${nuevaSuscripcion}" para UID: ${uid}. ElevensLab: ${elevensLabFinal}. Vencimiento: ${fechaVencimiento}`,
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
