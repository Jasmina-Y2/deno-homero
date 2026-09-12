import { db } from "../config/firebase.ts";

export const crearColeccionService = async (data: any): Promise<string> => {
    try {
        const docRef = await db.collection("Coleccion").add({
            ...data,
            calificacion: data.calificacion || 0,
            totalCalificaciones: data.totalCalificaciones || 0,
            sumaCalificaciones: data.sumaCalificaciones || 0,
            fechaCreacion: new Date().toISOString()
        });
        await db.collection("ColeccionIds").doc(data.uid).set({
            historias: [],
            creadoEn: new Date().toISOString(),
        });

        console.log("✅ Colección e Historial de IDs creados con éxito");
        return docRef.id;

    } catch (error) {
        console.error("❌ Error al crear la colección en el backend:", error);
        throw new Error("No se pudo procesar la creación de la colección");
    }
};

export const mostrarColeccionesPorAutorService = async (idAutor: string) => {
    if (!idAutor) throw new Error("Se requiere el idAutor");

    try {
        const querySnapshot = await db.collection("Coleccion")
            .where("idAutor", "==", idAutor)
            .get();

        if (querySnapshot.empty) return [];

        return querySnapshot.docs.map((doc:any) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error(`❌ Error buscando colecciones del autor ${idAutor}:`, error);
        throw new Error("Error al buscar colecciones del autor");
    }
};

export const getColeccionesPorIdService = async (uid: string) => {
    try {
        const snapshot = await db.collection("Coleccion")
            .where("uid", "==", uid)
            .get();

        return snapshot.docs.map((doc:any) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error("❌ Error en getColeccionesPorIdService:", error);
        throw new Error("Error al obtener las colecciones del usuario");
    }
};
export const eliminarColeccionesPorUidService = async (uid: string) => {
    try {
        const snapshot = await db.collection("Coleccion")
            .where("uid", "==", uid)
            .get();
        if (snapshot.empty) {
            return { message: "No se encontraron colecciones para este usuario." };
        }
        const deletePromises = snapshot.docs.map((doc:any) => doc.ref.delete());
        await Promise.all(deletePromises);

        return { message: "Colecciones eliminadas exitosamente." };
    } catch (error) {
        console.error("❌ Error en eliminarColeccionesPorUidService:", error);
        throw new Error("Error al eliminar las colecciones del usuario");
    }
};

export const getTodasLasColeccionesService = async () => {
    try {
        const snapshot = await db.collection("Coleccion").get();

        return snapshot.docs.map((doc:any) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error("❌ Error en getTodasLasColeccionesService:", error);
        throw new Error("Error al obtener todas las colecciones");
    }
};

/**
 * Califica una colección con una puntuación entre 1 y 5 estrellas.
 * Si el usuario ya votó, actualiza su voto y recalcula el promedio.
 */
export const calificarColeccionService = async (
    idColeccion: string,
    idUsuario: string,
    puntuacion: number,
    nombreUsuario?: string
) => {
    if (!idColeccion || !idUsuario) {
        throw new Error("Se requiere 'idColeccion' (o 'uid') y 'idUsuario'.");
    }

    const numEstrellas = Number(puntuacion);
    if (isNaN(numEstrellas) || numEstrellas < 1 || numEstrellas > 5) {
        throw new Error("La puntuación debe ser un número entero entre 1 y 5 estrellas.");
    }

    try {
        // 1. Encontrar el documento de la Colección en Firestore
        let coleccionDocRef = db.collection("Coleccion").doc(idColeccion);
        let coleccionSnap = await coleccionDocRef.get();
        let uidColeccion = idColeccion;

        if (!coleccionSnap.exists) {
            const querySnap = await db.collection("Coleccion").where("uid", "==", idColeccion).get();
            if (!querySnap.empty) {
                coleccionDocRef = querySnap.docs[0].ref;
                coleccionSnap = querySnap.docs[0];
                uidColeccion = querySnap.docs[0].data()?.uid || idColeccion;
            } else {
                throw new Error(`No se encontró ninguna colección con el ID o UID: ${idColeccion}`);
            }
        } else {
            uidColeccion = coleccionSnap.data()?.uid || idColeccion;
        }

        const coleccionData = coleccionSnap.data() || {};
        let totalCalificaciones = Number(coleccionData.totalCalificaciones || 0);
        let sumaCalificaciones = Number(coleccionData.sumaCalificaciones || 0);

        // 2. Verificar si el usuario ya había calificado esta colección antes
        const votoDocId = `${uidColeccion}_${idUsuario}`;
        const votoRef = db.collection("CalificacionesColeccion").doc(votoDocId);
        const votoSnap = await votoRef.get();

        let esPrimeraVez = true;
        let puntuacionAnterior = 0;

        if (votoSnap.exists) {
            esPrimeraVez = false;
            puntuacionAnterior = Number(votoSnap.data()?.puntuacion || 0);
        }

        // 3. Recalcular suma, total y promedio
        if (esPrimeraVez) {
            sumaCalificaciones += numEstrellas;
            totalCalificaciones += 1;
        } else {
            const diferencia = numEstrellas - puntuacionAnterior;
            sumaCalificaciones = Math.max(0, sumaCalificaciones + diferencia);
            // El total de votantes no cambia si solo actualizó su voto
        }

        const nuevoPromedio = totalCalificaciones > 0
            ? Number((sumaCalificaciones / totalCalificaciones).toFixed(1))
            : 0;

        const batch = db.batch();

        // 4. Guardar el voto del usuario en CalificacionesColeccion
        batch.set(votoRef, {
            idColeccion: uidColeccion,
            idUsuario,
            puntuacion: numEstrellas,
            puntuacionAnterior: esPrimeraVez ? null : puntuacionAnterior,
            nombreUsuario: nombreUsuario || null,
            fecha: new Date().toISOString(),
            actualizadoEn: new Date().toISOString(),
        }, { merge: true });

        // 5. Actualizar los campos calificacion, totalCalificaciones y sumaCalificaciones en Coleccion
        batch.set(coleccionDocRef, {
            calificacion: nuevoPromedio,
            totalCalificaciones,
            sumaCalificaciones,
            actualizadoEn: new Date().toISOString(),
        }, { merge: true });

        // 6. Actualizar las tarjetas asociadas en CardHistoria
        const cardsSnap = await db.collection("CardHistoria").where("Coleccion.uid", "==", uidColeccion).get();
        cardsSnap.docs.forEach((docSnap) => {
            const cData = docSnap.data();
            if (cData.Coleccion && typeof cData.Coleccion === "object") {
                batch.update(docSnap.ref, {
                    "Coleccion.calificacion": nuevoPromedio,
                    "Coleccion.totalCalificaciones": totalCalificaciones,
                });
            }
        });

        await batch.commit();
        console.log(`⭐ Calificación registrada para colección ${uidColeccion}: ${numEstrellas} estrellas. Nuevo promedio: ${nuevoPromedio} (${totalCalificaciones} votos)`);

        return {
            idColeccion: uidColeccion,
            calificacion: nuevoPromedio,
            totalCalificaciones,
            miCalificacion: numEstrellas,
            yaCalifico: true,
            mensaje: esPrimeraVez
                ? "¡Calificación guardada con éxito!"
                : "¡Calificación actualizada con éxito!",
        };
    } catch (error) {
        console.error("❌ Error en calificarColeccionService:", error);
        throw new Error(error instanceof Error ? error.message : "Error al registrar la calificación");
    }
};

/**
 * Obtiene la calificación promedio y el estado de voto del usuario para una colección.
 */
export const obtenerCalificacionColeccionService = async (
    idColeccion: string,
    idUsuario?: string
) => {
    if (!idColeccion) throw new Error("Se requiere 'idColeccion' o 'uid'");

    try {
        let coleccionDocRef = db.collection("Coleccion").doc(idColeccion);
        let coleccionSnap = await coleccionDocRef.get();
        let uidColeccion = idColeccion;

        if (!coleccionSnap.exists) {
            const querySnap = await db.collection("Coleccion").where("uid", "==", idColeccion).get();
            if (!querySnap.empty) {
                coleccionSnap = querySnap.docs[0];
                uidColeccion = querySnap.docs[0].data()?.uid || idColeccion;
            }
        } else {
            uidColeccion = coleccionSnap.data()?.uid || idColeccion;
        }

        const data = coleccionSnap.exists ? coleccionSnap.data() : {};
        const calificacion = Number(data?.calificacion || 0);
        const totalCalificaciones = Number(data?.totalCalificaciones || 0);

        let miCalificacion: number | null = null;
        let yaCalifico = false;

        if (idUsuario) {
            const votoDocId = `${uidColeccion}_${idUsuario}`;
            const votoSnap = await db.collection("CalificacionesColeccion").doc(votoDocId).get();
            if (votoSnap.exists) {
                miCalificacion = Number(votoSnap.data()?.puntuacion || 0);
                yaCalifico = true;
            }
        }

        return {
            idColeccion: uidColeccion,
            calificacion,
            totalCalificaciones,
            miCalificacion,
            yaCalifico,
        };
    } catch (error) {
        console.error("❌ Error en obtenerCalificacionColeccionService:", error);
        throw new Error("Error al obtener la calificación de la colección");
    }
};

/**
 * Elimina la calificación dada por un usuario a una colección.
 */
export const eliminarCalificacionColeccionService = async (
    idColeccion: string,
    idUsuario: string
) => {
    if (!idColeccion || !idUsuario) {
        throw new Error("Se requiere 'idColeccion' y 'idUsuario'");
    }

    try {
        let coleccionDocRef = db.collection("Coleccion").doc(idColeccion);
        let coleccionSnap = await coleccionDocRef.get();
        let uidColeccion = idColeccion;

        if (!coleccionSnap.exists) {
            const querySnap = await db.collection("Coleccion").where("uid", "==", idColeccion).get();
            if (!querySnap.empty) {
                coleccionDocRef = querySnap.docs[0].ref;
                coleccionSnap = querySnap.docs[0];
                uidColeccion = querySnap.docs[0].data()?.uid || idColeccion;
            }
        } else {
            uidColeccion = coleccionSnap.data()?.uid || idColeccion;
        }

        const votoDocId = `${uidColeccion}_${idUsuario}`;
        const votoRef = db.collection("CalificacionesColeccion").doc(votoDocId);
        const votoSnap = await votoRef.get();

        if (!votoSnap.exists) {
            return {
                message: "El usuario no había calificado esta colección.",
            };
        }

        const puntuacionEliminada = Number(votoSnap.data()?.puntuacion || 0);
        const data = coleccionSnap.data() || {};
        const totalCalificaciones = Math.max(0, Number(data.totalCalificaciones || 0) - 1);
        const sumaCalificaciones = Math.max(0, Number(data.sumaCalificaciones || 0) - puntuacionEliminada);
        const nuevoPromedio = totalCalificaciones > 0
            ? Number((sumaCalificaciones / totalCalificaciones).toFixed(1))
            : 0;

        const batch = db.batch();
        batch.delete(votoRef);
        batch.set(coleccionDocRef, {
            calificacion: nuevoPromedio,
            totalCalificaciones,
            sumaCalificaciones,
            actualizadoEn: new Date().toISOString(),
        }, { merge: true });

        await batch.commit();

        return {
            idColeccion: uidColeccion,
            calificacion: nuevoPromedio,
            totalCalificaciones,
            miCalificacion: null,
            yaCalifico: false,
            mensaje: "Calificación eliminada con éxito.",
        };
    } catch (error) {
        console.error("❌ Error en eliminarCalificacionColeccionService:", error);
        throw new Error("Error al eliminar la calificación");
    }
};
