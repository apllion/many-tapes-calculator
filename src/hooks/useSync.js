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
const LOCAL_ONLY_ACTIONS = new Set(['SET_ACTIVE', 'SET_ACTIVE_TOTAL']);

function getSharedState(state) {
  return {
    tapes: state.tapes,
    totals: state.totals || [],
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

  // Keep stateRef current so peer-join handler can access latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cleanup = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    sendActionRef.current = null;
    sendStateRef.current = null;
    setPeerCount(0);
    setStatus('disconnected');
    setRoomId(null);
  }, []);

  const connect = useCallback((code, isCreator) => {
    // Clean up any existing room
    if (roomRef.current) {
      roomRef.current.leave();
    }

    setStatus('connecting');
    setRoomId(code);

    const room = joinRoom({ appId: APP_ID }, code);
    roomRef.current = room;

    // Creators are established from the start (they own the state).
    // Joiners become established after receiving their first state sync.
    let established = isCreator;

    const [sendAction, onAction] = room.makeAction('action');
    const [sendState, onState] = room.makeAction('state');

    sendActionRef.current = sendAction;
    sendStateRef.current = sendState;

    room.onPeerJoin((peerId) => {
      setPeerCount(Object.keys(room.getPeers()).length);
      setStatus('connected');
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
        totals: sharedState.totals,
        settings: sharedState.settings,
        _remote: true,
      });
    });
  }, [rawDispatch]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

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
