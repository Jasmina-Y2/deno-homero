export interface HistoriaData {
    id?: string;
    titulo: string;
    generos: string[];
    historia: Array<{ texto: string; imagen?: string }>;
    idAutor: string;
    fechaCreacion: string;
    vistas: number;
}