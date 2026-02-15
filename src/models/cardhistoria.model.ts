export interface CardHistoria {
    id: string;
    idAutor: string;
    categoriaID: string | null;

    titulo: string;
    autor: string;
    autor2?: string;
    photoURL: string;
    descripcionES: string;
    descripcionEN: string;
    generos: string[];
    edad: string;
    categoriaNombre: string | null;
    imgCategoria: string | null;
    imagen: string;
    video: string;
    colorDominante: string;
    paginas: number | null;
    fecha: string;
}