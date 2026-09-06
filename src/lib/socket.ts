import { io, type Socket } from 'socket.io-client'
import { getStoredToken } from './api'

// L'origine du serveur socket.io est l'hote nu, sans le prefixe /api ajoute
// par app.setGlobalPrefix() cote backend (main.ts) — sinon socket.io essaie
// de handshaker sur /api/socket.io au lieu de /socket.io.
function socketOrigin(): string {
  return new URL(import.meta.env.VITE_API_URL).origin
}

let socket: Socket | null = null

// Ouvre la connexion temps reel apres un login/restoreSession reussi — le
// token JWT est passe via `auth`, pas un header (impossible en WebSocket
// natif). Reutilise la connexion existante si deja ouverte (ex: plusieurs
// composants montes en meme temps).
export function connectSocket(): Socket {
  if (socket) return socket
  const token = getStoredToken()
  socket = io(socketOrigin(), {
    auth: { token },
    transports: ['websocket'],
  })
  return socket
}

// Appele au logout — sans ca le serveur garde une socket authentifiee au nom
// de l'utilisateur precedent jusqu'a expiration du token.
export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function getSocket(): Socket | null {
  return socket
}
