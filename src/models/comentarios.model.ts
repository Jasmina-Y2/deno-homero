export interface ComentarioItem {
  idDoc?: string;
  id?: string;
  publicacionId: string;
  texto?: string;
  comentario?: string | any;
  fecha?: string;
  createdAt?: string;
  idAutor?: string;
  uid?: string;
  nombre?: string;
  autorNombre?: string;
  photoURL?: string;
  verificado?: boolean;
  marco_perfil_id?: string | null;
  [key: string]: any;
}

