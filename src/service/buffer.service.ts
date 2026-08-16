import { db, fieldValue } from "../config/firebase.ts";
const vistasBuffer = new Map<string, Set<string>>();
let totalVistasAcumuladas = 0;
let totalVistasHistoriasAcumuladas = 0;

const vistasHistoriaBuffer = new Map<string, number>();
export const procesarBufferVistas = async () => {
  if (vistasBuffer.size === 0) return;

  console.log(
    `Subiendo ${totalVistasAcumuladas} vistas acumuladas a Firestore...`,
  );

  const bufferAProcesar = new Map(vistasBuffer);
  vistasBuffer.clear();
  totalVistasAcumuladas = 0;

  try {
    const batch = db.batch();

    for (const [idUsuario, historiasSet] of bufferAProcesar.entries()) {
      const vistasRef = db.collection("Vistasuser").doc(idUsuario);
      const arrayHistorias = Array.from(historiasSet);

      batch.set(vistasRef, {
        vistas: fieldValue.arrayUnion(...arrayHistorias),
      }, { merge: true });
    }

    await batch.commit();
    console.log(
      `✅ Lote subido exitosamente. Se actualizaron ${bufferAProcesar.size} usuarios.`,
    );
  } catch (error) {
    console.error("❌ Error subiendo el lote de vistas a Firestore:", error);
  }
};

export const procesarBufferVistasHistorias = async () => {
  if (vistasHistoriaBuffer.size === 0) return;

  const bufferAProcesar = new Map(vistasHistoriaBuffer);
  vistasHistoriaBuffer.clear();
  totalVistasHistoriasAcumuladas = 0;

  console.log(
    `Subiendo ${bufferAProcesar.size} historias con vistas acumuladas a Firestore...`,
  );

  try {
    // Procesamos todas las actualizaciones en paralelo para mayor velocidad
    const promesas = Array.from(bufferAProcesar.entries()).map(
      async ([idHistoria, cantidadVistas]) => {
        // Buscamos el documento de la historia
        const snapshot = await db.collection("HistoriaInfo").where(
          "id",
          "==",
          idHistoria,
        ).get();

        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          // Sumamos de golpe todas las vistas que se acumularon (ej: increment(15))
          return docRef.update({
            vistas: fieldValue.increment(cantidadVistas),
          });
        }
      },
    );

    await Promise.all(promesas);
    console.log(`✅ Lote de vistas de historias subido exitosamente.`);
  } catch (error) {
    console.error(
      "❌ Error subiendo el lote de vistas de historias a Firestore:",
      error,
    );
  }
};
