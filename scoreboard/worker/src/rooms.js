// ─────────────────────────────────────────────────────────────────────────────
// Online co-op relay — one Durable Object per 4-letter room code.
//
//   GET /api/rooms/:CODE/ws?role=host|guest   (WebSocket upgrade)
//
// The relay is deliberately dumb: it pairs one host with one guest and forwards
// every text message between them. Games run their own protocol on top (the
// host is authoritative). System messages from the relay:
//   {t:"hosting"}       host connected, room open
//   {t:"joined"}        guest connected to a hosted room
//   {t:"peer_joined"}   (to host) a guest arrived
//   {t:"peer_left"}     the other side disconnected
//   {t:"error", error}  "taken" | "no_room" | "full" — then the socket closes
// Uses the WebSocket Hibernation API, so idle rooms cost nothing.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MESSAGE = 64 * 1024;

export class RoomRelay {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    const role = new URL(request.url).searchParams.get('role');
    if (role !== 'host' && role !== 'guest') return new Response('Bad role', { status: 400 });

    const hosts = this.state.getWebSockets('host');
    const guests = this.state.getWebSockets('guest');
    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server, [role]);

    const refuse = (error) => {
      server.send(JSON.stringify({ t: 'error', error }));
      server.close(4000, error);
    };

    if (role === 'host') {
      if (hosts.length > 0) refuse('taken');
      else server.send(JSON.stringify({ t: 'hosting' }));
    } else if (hosts.length === 0) {
      refuse('no_room');
    } else if (guests.length > 0) {
      refuse('full');
    } else {
      server.send(JSON.stringify({ t: 'joined' }));
      for (const h of hosts) this.#send(h, { t: 'peer_joined' });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    const [role] = this.state.getTags(ws);
    const other = role === 'host' ? 'guest' : 'host';
    for (const peer of this.state.getWebSockets(other)) {
      try {
        peer.send(message);
      } catch {
        /* peer already gone */
      }
    }
  }

  webSocketClose(ws, code, reason) {
    this.#left(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }

  webSocketError(ws) {
    this.#left(ws);
  }

  #left(ws) {
    const [role] = this.state.getTags(ws);
    const other = role === 'host' ? 'guest' : 'host';
    for (const peer of this.state.getWebSockets(other)) {
      if (peer !== ws) this.#send(peer, { t: 'peer_left' });
    }
  }

  #send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }
}
