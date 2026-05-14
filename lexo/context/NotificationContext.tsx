import React, { createContext, useCallback, useContext, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  useNotificationSocket,
  FriendInvitePayload,
  FriendInviteResponsePayload,
} from '../hooks/useNotificationSocket';

type Listener<T> = (payload: T) => void;
type Unsubscribe = () => void;

interface NotificationContextValue {
  isConnected: boolean;
  declineInvite: (inviteId: string) => void;
  onFriendInvite: (listener: Listener<FriendInvitePayload>) => Unsubscribe;
  onFriendInviteAccepted: (listener: Listener<FriendInviteResponsePayload>) => Unsubscribe;
  onFriendInviteDeclined: (listener: Listener<FriendInviteResponsePayload>) => Unsubscribe;
  onFriendInviteCancelled: (listener: Listener<FriendInviteResponsePayload>) => Unsubscribe;
}

const NotificationContext = createContext<NotificationContextValue>({
  isConnected: false,
  declineInvite: () => {},
  onFriendInvite: () => () => {},
  onFriendInviteAccepted: () => () => {},
  onFriendInviteDeclined: () => () => {},
  onFriendInviteCancelled: () => () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();

  const inviteListeners = useRef<Set<Listener<FriendInvitePayload>>>(new Set());
  const acceptedListeners = useRef<Set<Listener<FriendInviteResponsePayload>>>(new Set());
  const declinedListeners = useRef<Set<Listener<FriendInviteResponsePayload>>>(new Set());
  const cancelledListeners = useRef<Set<Listener<FriendInviteResponsePayload>>>(new Set());

  const { isConnected, declineInvite } = useNotificationSocket({
    enabled: !!isSignedIn,
    onFriendInvite: (p) => inviteListeners.current.forEach((l) => l(p)),
    onFriendInviteAccepted: (p) => acceptedListeners.current.forEach((l) => l(p)),
    onFriendInviteDeclined: (p) => declinedListeners.current.forEach((l) => l(p)),
    onFriendInviteCancelled: (p) => cancelledListeners.current.forEach((l) => l(p)),
  });

  const subscribe = <T,>(set: React.MutableRefObject<Set<Listener<T>>>, listener: Listener<T>): Unsubscribe => {
    set.current.add(listener);
    return () => set.current.delete(listener);
  };

  const onFriendInvite = useCallback(
    (l: Listener<FriendInvitePayload>) => subscribe(inviteListeners, l),
    [],
  );
  const onFriendInviteAccepted = useCallback(
    (l: Listener<FriendInviteResponsePayload>) => subscribe(acceptedListeners, l),
    [],
  );
  const onFriendInviteDeclined = useCallback(
    (l: Listener<FriendInviteResponsePayload>) => subscribe(declinedListeners, l),
    [],
  );
  const onFriendInviteCancelled = useCallback(
    (l: Listener<FriendInviteResponsePayload>) => subscribe(cancelledListeners, l),
    [],
  );

  return (
    <NotificationContext.Provider
      value={{
        isConnected,
        declineInvite,
        onFriendInvite,
        onFriendInviteAccepted,
        onFriendInviteDeclined,
        onFriendInviteCancelled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
