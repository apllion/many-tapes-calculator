import { useState, useEffect, useRef, useCallback } from 'react';
import { joinRoom } from 'trystero/nostr';
import { enrichAction } from './useAppState.js';

const APP_ID = 'many-tapes-calc-v1';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Actions that are purely local and should not be broadcast
const LOCAL_ONLY_ACTIONS = new Set(['SET_ACTIVE']);

function getSharedState(state) {
  return {
    tapes: state.tapes,
    settings: state.settings || {},
  };
}

export function useSync(state, rawDispatch) {
  const [roomId, setRoomId] = useState(null);
  const [peerCount, setPeerCount] = useState(0);
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected

  const roomRef = useRef(null);
  const sendActionRef = useRef(null);
  const sendStateRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const reconnectRef = useRef(null); // { code, isCreator, timer, delay }
  const heartbeatRef = useRef(null);

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current?.timer) {
      clearTimeout(reconnectRef.current.timer);
    }
    reconnectRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    clearReconnect();
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    sendActionRef.current = null;
    sendStateRef.current = null;
    setPeerCount(0);
    setStatus('disconnected');
    setRoomId(null);
  }, [clearReconnect]);

  const connect = useCallback((code, isCreator) => {
    // Clean up any existing room (but keep reconnect info)
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    sendActionRef.current = null;
    sendStateRef.current = null;

    setStatus('connecting');
    setRoomId(code);

    // Store reconnect info
    if (!reconnectRef.current || reconnectRef.current.code !== code) {
      clearReconnect();
      reconnectRef.current = { code, isCreator, timer: null, delay: 1000 };
    }

    let room;
    try {
      room = joinRoom({ appId: APP_ID }, code);
    } catch {
      scheduleReconnect();
      return;
    }
    roomRef.current = room;

    // Creators are established from the start (they own the state).
    // Joiners become established after receiving their first state sync.
    let established = isCreator;

    const [sendAction, onAction] = room.makeAction('action');
    const [sendState, onState] = room.makeAction('state');
    const [sendPing, onPing] = room.makeAction('ping');

    sendActionRef.current = sendAction;
    sendStateRef.current = sendState;

    // Heartbeat ping every 15s
    const heartbeatInterval = setInterval(() => {
      if (Object.keys(room.getPeers()).length > 0) {
        sendPing({ t: Date.now() });
      }
    }, 15000);
    onPing(() => {}); // receipt updates Trystero's internal tracking

    room.onPeerJoin((peerId) => {
      setPeerCount(Object.keys(room.getPeers()).length);
      setStatus('connected');
      // Reset reconnect delay on successful connection
      if (reconnectRef.current) reconnectRef.current.delay = 1000;
      // Only send state if we're established (creator or already synced)
      if (established) {
        sendState(getSharedState(stateRef.current), peerId);
      }
    });

    room.onPeerLeave(() => {
      const count = Object.keys(room.getPeers()).length;
      setPeerCount(count);
      if (count === 0) {
        setStatus('connecting');
        scheduleReconnect();
      }
    });

    onAction((action) => {
      // Dispatch remote action — _remote flag skips local view changes
      rawDispatch({ ...action, _remote: true });
    });

    onState((sharedState) => {
      // Now we have authoritative state — we're established
      established = true;
      rawDispatch({
        type: 'SYNC_STATE',
        tapes: sharedState.tapes,
        settings: sharedState.settings,
        _remote: true,
      });
    });

    // Return cleanup for heartbeat
    heartbeatRef.current = heartbeatInterval;
  }, [rawDispatch, clearReconnect]);

  function scheduleReconnect() {
    const info = reconnectRef.current;
    if (!info || info.timer) return;
    info.timer = setTimeout(() => {
      info.timer = null;
      info.delay = Math.min(info.delay * 1.5, 30000);
      connect(info.code, info.isCreator);
    }, info.delay);
  }

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  // Visibility-based immediate reconnect
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      const info = reconnectRef.current;
      if (!info) return;
      // Force immediate reconnect attempt with reset delay
      if (info.timer) {
        clearTimeout(info.timer);
        info.timer = null;
      }
      info.delay = 1000;
      connect(info.code, info.isCreator);
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [connect]);

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    connect(code, true);
    return code;
  }, [connect]);

  const joinRoomByCode = useCallback((code) => {
    connect(code.toUpperCase().trim(), false);
  }, [connect]);

  const leaveRoom = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Sync-aware dispatch: enriches, dispatches locally, broadcasts to peers
  const syncDispatch = useCallback((action) => {
    const enriched = enrichAction(action, stateRef.current);
    rawDispatch(enriched);

    // Broadcast to peers (unless local-only or already a LOAD_STATE)
    if (sendActionRef.current && !LOCAL_ONLY_ACTIONS.has(enriched.type)) {
      if (enriched.type === 'LOAD_STATE') {
        // Import/load: send as full state sync to peers
        if (sendStateRef.current) {
          sendStateRef.current(getSharedState(enriched.state));
        }
      } else {
        // Strip _remote flag if present, send the enriched action
        const { _remote, ...toSend } = enriched;
        sendActionRef.current(toSend);
      }
    }
  }, [rawDispatch]);

  return {
    syncDispatch,
    roomId,
    peerCount,
    status,
    createRoom,
    joinRoom: joinRoomByCode,
    leaveRoom,
  };
}
