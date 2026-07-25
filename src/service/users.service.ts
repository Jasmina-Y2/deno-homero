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
    return {
      idDoc: userDoc.id,
      ...userDoc.data(),
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
    return {
      idDoc: userDoc.id,
      ...userDoc.data(),
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
    };
  } catch (error) {
    console.error("Error en crearUsuarioService:", error);
    throw new Error("Error al crear el perfil del usuario en la base de datos");
  }
};
