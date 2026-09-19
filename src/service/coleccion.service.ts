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
export const eliminarColeccionesPorUidService = async (
    uid: string,
    userUid?: string,
    isAdmin?: boolean
) => {
    try {
        // Buscar por doc id directo, o por campo 'uid' de la colección, o por campo 'idAutor'
        const docDirect = await db.collection("Coleccion").doc(uid).get();
        const snapUid = await db.collection("Coleccion").where("uid", "==", uid).get();
        const snapAutor = await db.collection("Coleccion").where("idAutor", "==", uid).get();

        const docsAEliminar = new Map<string, any>();
        if (docDirect.exists) {
            docsAEliminar.set(docDirect.id, docDirect);
        }
        snapUid.docs.forEach((doc: any) => docsAEliminar.set(doc.id, doc));
        snapAutor.docs.forEach((doc: any) => docsAEliminar.set(doc.id, doc));

        if (docsAEliminar.size === 0) {
            // Intentar borrar también ColeccionIds huérfano si existiera
            const colIdsRef = db.collection("ColeccionIds").doc(uid);
            const colIdsSnap = await colIdsRef.get();
            if (colIdsSnap.exists) {
                await colIdsRef.delete();
            }
            return { message: "No se encontraron colecciones para este identificador." };
        }

        // Verificación de pertenencia si se pasa userUid y no es admin
        if (userUid && !isAdmin) {
            for (const doc of docsAEliminar.values()) {
                const data = doc.data();
                const idAutor = data.idAutor || data.uidAutor || data.idUsuario;
                if (idAutor && idAutor !== userUid && data.uid !== userUid && doc.id !== userUid) {
                    throw new Error("FORBIDDEN");
                }
            }
        }

        const batch = db.batch();
        for (const doc of docsAEliminar.values()) {
            batch.delete(doc.ref);
            const colUid = doc.data()?.uid || doc.id;
            // Borrar documento en ColeccionIds
            const colIdsRef = db.collection("ColeccionIds").doc(colUid);
            batch.delete(colIdsRef);
            if (doc.id !== colUid) {
                batch.delete(db.collection("ColeccionIds").doc(doc.id));
            }
            // Borrar calificaciones de esta colección
            const califSnap = await db.collection("CalificacionesColeccion")
                .where("idColeccion", "==", colUid)
                .get();
            califSnap.docs.forEach((cDoc: any) => batch.delete(cDoc.ref));
        }

        await batch.commit();
        return { message: "Colecciones eliminadas exitosamente.", eliminadas: docsAEliminar.size };
    } catch (error) {
        console.error("❌ Error en eliminarColeccionesPorUidService:", error);
        throw error;
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

/**
 * Actualiza el nombre, descripción, géneros o imagen de una colección en Firestore
 * y sincroniza los cambios en cascada con las historias asociadas.
 */
export const actualizarColeccionService = async (
    uid: string,
    data: {
        nombre?: string;
        titulo?: string;
        descripcion?: string;
        generos?: string[];
        img?: string;
    },
    userUid?: string,
    isAdmin?: boolean
) => {
    if (!uid) throw new Error("Se requiere el UID o ID de la colección.");

    try {
        // 1. Localizar el documento en Firestore
        let docRef = db.collection("Coleccion").doc(uid);
        let docSnap = await docRef.get();
        let colDocId = uid;
        let colUid = uid;

        if (!docSnap.exists) {
            const querySnap = await db.collection("Coleccion").where("uid", "==", uid).get();
            if (!querySnap.empty) {
                docRef = querySnap.docs[0].ref;
                docSnap = querySnap.docs[0];
                colDocId = querySnap.docs[0].id;
                colUid = querySnap.docs[0].data()?.uid || uid;
            } else {
                throw new Error("Colección no encontrada");
            }
        } else {
            colUid = docSnap.data()?.uid || uid;
        }

        const currentData = docSnap.data() || {};

        // 2. Verificación de permisos si se especifica userUid
        if (userUid && !isAdmin) {
            const idAutor = currentData.idAutor || currentData.uidAutor || currentData.idUsuario;
            if (idAutor && idAutor !== userUid && currentData.uid !== userUid && docSnap.id !== userUid) {
                throw new Error("FORBIDDEN");
            }
        }

        // 3. Preparar actualizaciones
        const updates: Record<string, any> = {
            actualizadoEn: new Date().toISOString(),
        };

        const nuevoNombre = data.nombre || data.titulo;
        if (nuevoNombre !== undefined && nuevoNombre.trim() !== "") {
            updates.nombre = nuevoNombre.trim();
            updates.titulo = nuevoNombre.trim();
        }

        if (data.descripcion !== undefined) {
            updates.descripcion = data.descripcion.trim();
        }

        if (data.generos !== undefined && Array.isArray(data.generos)) {
            updates.generos = data.generos;
        }

        if (data.img !== undefined && data.img.trim() !== "") {
            updates.img = data.img.trim();
        }

        const batch = db.batch();
        batch.update(docRef, updates);

        // 4. Actualizar en cascada las historias de esta colección en CardHistoria, HistoriaInfo, Historia
        const coleccionesACascadear = ["CardHistoria", "HistoriaInfo", "Historia"];
        for (const colName of coleccionesACascadear) {
            const [snap1, snap2] = await Promise.all([
                db.collection(colName).where("Coleccion.uid", "==", colUid).get().catch(() => ({ docs: [] })),
                db.collection(colName).where("Coleccion.id", "==", colUid).get().catch(() => ({ docs: [] })),
            ]);

            const docsToUpdate = new Map<string, any>();
            snap1.docs.forEach((d: any) => docsToUpdate.set(d.id, d));
            snap2.docs.forEach((d: any) => docsToUpdate.set(d.id, d));

            for (const storyDoc of docsToUpdate.values()) {
                const storyData = storyDoc.data();
                const currentCol = storyData.Coleccion || {};
                const updatedCol = {
                    ...currentCol,
                    ...(updates.nombre ? { nombre: updates.nombre, titulo: updates.nombre } : {}),
                    ...(updates.descripcion !== undefined ? { descripcion: updates.descripcion } : {}),
                    ...(updates.img ? { img: updates.img } : {}),
                };

                batch.update(storyDoc.ref, {
                    Coleccion: updatedCol,
                });
            }
        }

        await batch.commit();
        console.log(`✅ Colección ${colUid} actualizada con éxito:`, updates);

        const updatedDoc = await docRef.get();
        return {
            id: colDocId,
            uid: colUid,
            ...updatedDoc.data(),
        };
    } catch (error) {
        console.error("❌ Error en actualizarColeccionService:", error);
        throw error;
    }
};

