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

export type WebSocketAction = "join" | "leave" | "new_comment" | "ping";

export interface ComentarioWebSocketMessage {
  action: WebSocketAction;
  publicacionId?: string;
  uid?: string;
  comentario?: any;
}
