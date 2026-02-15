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
