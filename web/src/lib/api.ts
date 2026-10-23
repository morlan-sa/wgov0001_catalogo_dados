import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  // Envia o cookie de sessão HttpOnly do BFF (ver @morlan/access-web) —
  // exige mesma origem (proxy em dev/vite.config.ts, nginx em prod);
  // withCredentials sozinho não faz o cookie SameSite=Lax atravessar uma
  // chamada cross-origin de verdade.
  withCredentials: true,
  // Sem isto, arrays viram `status[]=a&status[]=b` — muitos backends
  // (ex.: FastAPI) só fazem bind de `list[str]` a partir de chaves repetidas
  // sem colchetes (`status=a&status=b`).
  paramsSerializer: { indexes: null },
})

export { api }
