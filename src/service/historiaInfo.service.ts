import { db, fieldValue } from "../config/firebase.ts";
import { HistoriaInfo } from "../models/historiainfo.model.ts";
import { procesarBufferVistasHistorias } from "./buffer.service.ts";
const vistasHistoriaBuffer = new Map<string, number>();

const UMBRAL_VISTAS_HISTORIAS = 50;
let totalVistasHistoriasAcumuladas = 0;

export const guardarHistoriaInfoEnFirestoreService = async (
  data: HistoriaInfo,
): Promise<string> => {
  try {
    const docRef = await db.collection("HistoriaInfo").add(data);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error guardando info historia:", error);
    throw new Error("Error al guardar información de la historia");
  }
};

export const obtenerCardsPorAutorService = async (idAutor: string) => {
  try {
    const snapshot = await db.collection("HistoriaInfo")
      .where("idAutor", "==", idAutor)
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error(error);
    throw error;
  }
};
export const getCardHistoriasService = async () => {
  try {
    const snapshot = await db.collection("HistoriaInfo").get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error(error);
    throw new Error("Error al obtener las historias de la base de datos");
  }
};

export const incrementarVistasService = async (id: string) => {
  try {
    const vistasActualesEnBuffer = vistasHistoriaBuffer.get(id) || 0;

    vistasHistoriaBuffer.set(id, vistasActualesEnBuffer + 1);

    totalVistasHistoriasAcumuladas++;
    console.log(
      `Memoria RAM: +1 vista a la historia ${id} (Total en espera: ${totalVistasHistoriasAcumuladas})`,
    );

    if (totalVistasHistoriasAcumuladas >= UMBRAL_VISTAS_HISTORIAS) {
      procesarBufferVistasHistorias();
    }

    return true;
  } catch (error) {
    console.error(`❌ Error en incrementarVistasService (ID: ${id}):`, error);
    throw error;
  }
};
export const actualizarLikesHelper = async (
  idPublicacion: string,
  operacion: "sumar" | "restar",
) => {
  try {
    const snapshot = await db.collection("HistoriaInfo").where(
      "id",
      "==",
      idPublicacion,
    ).get();
    if (!snapshot.empty) {
      const val = operacion === "sumar" ? 1 : -1;
      await snapshot.docs[0].ref.update({ likes: fieldValue.increment(val) });
    }
  } catch (error) {
    console.error(`⚠️ Error auxiliar actualizando contador de likes:`, error);
  }
};

export const getHistoriaByIdService = async (id: string) => {
  try {
    const snapshot = await db.collection("HistoriaInfo")
      .where("id", "==", id)
      .get();

    if (snapshot.empty) return [];

    const vistasPendientes = vistasHistoriaBuffer.get(id) || 0;

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        idDoc: doc.id,
        ...data,
        vistas: (data.vistas || 0) + vistasPendientes,
      };
    });
  } catch (error) {
    console.error("❌ Error en getHistoriaByIdService:", error);
    throw new Error("No se pudo obtener la información de la historia");
  }
};

export const getHistoriasPorVistas = async () => {
  try {
    const snapshot = await db.collection("HistoriaInfo")
      .orderBy("vistas", "desc")
      .limit(10)
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map((doc) => ({
      idDoc: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("❌ Error en getHistoriaByIdService:", error);
    throw new Error("No se pudo obtener la información de la historia");
  }
};
