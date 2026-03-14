export interface HistoriaData {
    titulo: string;
    generos: string[];
    historia: Array<{ texto: string; imagen?: string }>;
    partes: string[];
    autor: string;
    id: string;
    idAutor: string;
    colorDominante: string;
}
export interface ContenidoHistoria {
    textoES: string;
    imagen: string;
    vozES: string;
    vozEN: string;
}

export interface HistoriaDocument {
    idDoc: string;
    id: string;
    titulo: string;
    autor: string;
    autor2: string;
    idAutor: string;
    photoURL: string;
    colorDominante: string;
    categoriaID: string;
    categoriaNombre: string;
    imgCategoria: string;
    partes: string[];
    historia: ContenidoHistoria[];
    generos: string[];
    edad: string;
}