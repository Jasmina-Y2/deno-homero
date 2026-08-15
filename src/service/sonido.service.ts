import { db } from "../config/firebase.ts";

export interface DatosSonido {
  id?: string;
  nombre: string;
  url: string;
  autorNombre: string;
  idSubioAutor: string;
  is_IA: boolean;
  fechaCreacion?: string;
}

export const crearSonidoService = async (datos: DatosSonido) => {
  try {
    const idDoc = datos.id || db.collection("Sonido").doc().id;
    const nuevoSonido: DatosSonido = {
      ...datos,
      id: idDoc,
      fechaCreacion: datos.fechaCreacion || new Date().toISOString(),
      is_IA: datos.is_IA || false,
    };

    await db.collection("Sonido").doc(idDoc).set(nuevoSonido);
    console.log(`Sonido creado exitosamente con ID: ${idDoc}`);

    return nuevoSonido;
  } catch (error) {
    console.error("Error en crearSonidoService:", error);
    throw new Error("Error al crear el sonido en la base de datos");
  }
};

export const obtenerSonidosService = async () => {
  try {
    const snapshot = await db.collection("Sonido").where("activo", "==", true)
      .get();

    const sonidos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return sonidos;
  } catch (error) {
    console.error("Error en obtenerSonidosService:", error);
    throw new Error("Error al obtener los sonidos de la base de datos");
  }
};

export const obtenerSonidoPorIdService = async (id: string) => {
  try {
    const docSnap = await db.collection("Sonido").doc(id).get();

    if (docSnap.exists) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.warn(`No se encontró el sonido con ID: ${id}`);
      return null;
    }
  } catch (error) {
    console.error("Error en obtenerSonidoPorIdService:", error);
    throw new Error("Error al obtener el sonido");
  }
};

export const modificarSonidoService = async (
  id: string,
  datosActualizados: Partial<DatosSonido>,
) => {
  try {
    await db.collection("Sonido").doc(id).update({
      ...datosActualizados,
      fechaModificacion: new Date().toISOString(),
    });

    console.log(`Sonido modificado exitosamente con ID: ${id}`);

    return {
      success: true,
      id,
    };
  } catch (error) {
    console.error("Error en modificarSonidoService:", error);
    throw new Error("Error al modificar el sonido en la base de datos");
  }
};
