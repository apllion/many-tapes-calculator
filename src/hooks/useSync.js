import { useState, useEffect, useRef, useCallback } from 'react';
import { joinRoom } from 'trystero/nostr';
import { enrichAction } from './useAppState.js';
import { loadRoom, saveRoom, clearRoom } from '../lib/storage.js';

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
    lastModified: state.lastModified,
  };
}

export function useSync(state, rawDispatch) {
  const [roomId, setRoomId] = useState(null);
  const [peerCount, setPeerCount] = useState(0);
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [connectingSince, setConnectingSince] = useState(null);

  const roomRef = useRef(null);
  const sendActionRef = useRef(null);
  const sendStateRef = useRef(null);
  const sendStateReqRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const reconnectRef = useRef(null); // { code, isCreator, timer, delay }
  const heartbeatRef = useRef(null);
  const establishedRef = useRef(false);
  const stateReqTimerRef = useRef(null);

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
    if (stateReqTimerRef.current) {
      clearTimeout(stateReqTimerRef.current);
      stateReqTimerRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    sendActionRef.current = null;
    sendStateRef.current = null;
    sendStateReqRef.current = null;
    establishedRef.current = false;
    setPeerCount(0);
    setStatus('disconnected');
    setRoomId(null);
    setConnectingSince(null);
  }, [clearReconnect]);

  const connect = useCallback((code, isCreator) => {
    // Clean up any existing room (but keep reconnect info)
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (stateReqTimerRef.current) {
      clearTimeout(stateReqTimerRef.current);
      stateReqTimerRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    sendActionRef.current = null;
    sendStateRef.current = null;
    sendStateReqRef.current = null;

    setStatus('connecting');
    setConnectingSince((prev) => prev ?? Date.now());
    setRoomId(code);

    // Persist room for auto-rejoin
    saveRoom(code, isCreator);

    // Creators are established from the start (they own the state).
    if (isCreator) {
      establishedRef.current = true;
    }

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

    const [sendAction, onAction] = room.makeAction('action');
    const [sendState, onState] = room.makeAction('state');
    const [sendPing, onPing] = room.makeAction('ping');
    const [sendStateReq, onStateReq] = room.makeAction('stateReq');

    sendActionRef.current = sendAction;
    sendStateRef.current = sendState;
    sendStateReqRef.current = sendStateReq;

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
      setConnectingSince(null);
      // Reset reconnect delay on successful connection
      if (reconnectRef.current) reconnectRef.current.delay = 1000;
      // Only send state if we're established (creator or already synced)
      if (establishedRef.current) {
        sendState(getSharedState(stateRef.current), peerId);
      } else {
        // Not yet established — set a 5s timer to request state if not received
        if (stateReqTimerRef.current) clearTimeout(stateReqTimerRef.current);
        stateReqTimerRef.current = setTimeout(() => {
          stateReqTimerRef.current = null;
          if (!establishedRef.current) {
            sendStateReq({}, peerId);
          }
        }, 5000);
      }
    });

    room.onPeerLeave(() => {
      const count = Object.keys(room.getPeers()).length;
      setPeerCount(count);
      if (count === 0) {
        setStatus('connecting');
        setConnectingSince((prev) => prev ?? Date.now());
        scheduleReconnect();
      }
    });

    onAction((action) => {
      // Dispatch remote action — _remote flag skips local view changes
      rawDispatch({ ...action, _remote: true });
    });

    onState((sharedState) => {
      // Cancel pending state request timer
      if (stateReqTimerRef.current) {
        clearTimeout(stateReqTimerRef.current);
        stateReqTimerRef.current = null;
      }
      // Only apply incoming state if it's newer (or we have no timestamp)
      const localModified = stateRef.current.lastModified;
      const remoteModified = sharedState.lastModified;
      if (localModified && remoteModified && remoteModified < localModified) {
        // Our state is newer — don't overwrite, but mark as established
        establishedRef.current = true;
        return;
      }
      // Now we have authoritative state — we're established
      establishedRef.current = true;
      rawDispatch({
        type: 'SYNC_STATE',
        tapes: sharedState.tapes,
        settings: sharedState.settings,
        lastModified: sharedState.lastModified,
        _remote: true,
      });
    });

    // Respond to state requests from peers
    onStateReq((_data, peerId) => {
      if (establishedRef.current) {
        sendState(getSharedState(stateRef.current), peerId);
      }
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

  // Auto-rejoin persisted room on mount
  useEffect(() => {
    const saved = loadRoom();
    if (saved) {
      // If local state has lastModified, returning peer has valid state
      if (stateRef.current.lastModified) {
        establishedRef.current = true;
      }
      connect(saved.code, saved.isCreator);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    clearRoom();
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
    connectingSince,
    createRoom,
    joinRoom: joinRoomByCode,
    leaveRoom,
  };
}
