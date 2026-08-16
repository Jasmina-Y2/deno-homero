import { db, fieldValue } from "../config/firebase.ts";
import { procesarBufferVistas } from "./buffer.service.ts";

const vistasBuffer = new Map<string, Set<string>>();

const UMBRAL_VISTAS = 50;
let totalVistasAcumuladas = 0;

export const registrarVistaUsuarioService = async (
  idUsuario: string,
  idHistoria: string,
) => {
  try {
    if (!vistasBuffer.has(idUsuario)) {
      vistasBuffer.set(idUsuario, new Set());
    }

    const vistasDelUsuario = vistasBuffer.get(idUsuario)!;

    if (!vistasDelUsuario.has(idHistoria)) {
      vistasDelUsuario.add(idHistoria);
      totalVistasAcumuladas++;

      console.log(
        `Memoria RAM: Vista registrada para usuario ${idUsuario} (Total global: ${totalVistasAcumuladas})`,
      );

      if (totalVistasAcumuladas >= UMBRAL_VISTAS) {
        procesarBufferVistas();
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ Error en registrarVistaUsuarioService:`, error);
    throw error;
  }
};

export const verificarHistoriaVistaService = async (
  idUsuario: string,
  idHistoria: string,
) => {
  try {
    if (!idUsuario || !idHistoria) return false;

    if (
      vistasBuffer.has(idUsuario) &&
      vistasBuffer.get(idUsuario)!.has(idHistoria)
    ) {
      return true;
    }

    const vistasSnap = await db.collection("Vistasuser").doc(idUsuario).get();

    if (vistasSnap.exists) {
      const listaVistas: string[] = vistasSnap.data()?.vistas || [];
      return listaVistas.includes(idHistoria);
    }
    return false;
  } catch (error) {
    console.error("❌ Error en verificarHistoriaVistaService:", error);
    return false;
  }
};

export const getHistoriasVistasService = async (idUsuario: string) => {
  try {
    const vistasSnap = await db.collection("Vistasuser").doc(idUsuario).get();
    let idsVistos: string[] = vistasSnap.exists
      ? (vistasSnap.data()?.vistas || [])
      : [];

    if (vistasBuffer.has(idUsuario)) {
      const vistasEnRam = Array.from(vistasBuffer.get(idUsuario)!);
      idsVistos = [...new Set([...idsVistos, ...vistasEnRam])];
    }

    if (idsVistos.length === 0) return [];

    const qSnap = await db.collection("CardHistoria")
      .where("id", "in", idsVistos.slice(0, 30))
      .get();

    return qSnap.docs.map((doc) => ({
      idDoc: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("❌ Error en getHistoriasVistasService:", error);
    throw new Error("Error al obtener historial de vistas");
  }
};
