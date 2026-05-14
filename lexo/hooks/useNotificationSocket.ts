import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { WS_BASE_URL } from '../utils/constants';
import { useWebSocket } from './useWebSocket';

export interface FriendInvitePayload {
  invite_id: string;
  from_user_id: string;
  from_username: string;
}

export interface FriendInviteResponsePayload {
  invite_id: string;
  from_user_id?: string;
  from_username?: string;
  message?: string;
}

interface UseNotificationSocketProps {
  onFriendInvite?: (_payload: FriendInvitePayload) => void;
  onFriendInviteAccepted?: (_payload: FriendInviteResponsePayload) => void;
  onFriendInviteDeclined?: (_payload: FriendInviteResponsePayload) => void;
  onFriendInviteCancelled?: (_payload: FriendInviteResponsePayload) => void;
  enabled?: boolean;
}

export const useNotificationSocket = ({
  onFriendInvite,
  onFriendInviteAccepted,
  onFriendInviteDeclined,
  onFriendInviteCancelled,
  enabled = true,
}: UseNotificationSocketProps = {}) => {
  const { isSignedIn } = useAuth();

  // Keep latest callbacks in refs so the message handler never goes stale
  const onFriendInviteRef = useRef(onFriendInvite);
  const onFriendInviteAcceptedRef = useRef(onFriendInviteAccepted);
  const onFriendInviteDeclinedRef = useRef(onFriendInviteDeclined);
  const onFriendInviteCancelledRef = useRef(onFriendInviteCancelled);

  useEffect(() => { onFriendInviteRef.current = onFriendInvite; }, [onFriendInvite]);
  useEffect(() => { onFriendInviteAcceptedRef.current = onFriendInviteAccepted; }, [onFriendInviteAccepted]);
  useEffect(() => { onFriendInviteDeclinedRef.current = onFriendInviteDeclined; }, [onFriendInviteDeclined]);
  useEffect(() => { onFriendInviteCancelledRef.current = onFriendInviteCancelled; }, [onFriendInviteCancelled]);

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'friend_invite':
        onFriendInviteRef.current?.({
          invite_id: data.invite_id,
          from_user_id: data.from_user_id,
          from_username: data.from_username,
        });
        break;
      case 'friend_invite_accepted':
        onFriendInviteAcceptedRef.current?.({
          invite_id: data.invite_id,
          from_user_id: data.from_user_id,
          from_username: data.from_username,
        });
        break;
      case 'friend_invite_declined':
        onFriendInviteDeclinedRef.current?.({
          invite_id: data.invite_id,
          message: data.message,
        });
        break;
      case 'friend_invite_cancelled':
        onFriendInviteCancelledRef.current?.({
          invite_id: data.invite_id,
          message: data.message,
        });
        break;
      // ping/pong handled by useWebSocket internally
    }
  }, []);

  const { isConnected, connect, disconnect, sendMessage } = useWebSocket({
    onMessage: handleMessage,
    autoReconnect: true,
  });

  useEffect(() => {
    if (!enabled || !isSignedIn) {
      disconnect();
      return;
    }
    connect(`${WS_BASE_URL}/ws/notify`);
    return () => {
      disconnect();
    };
  }, [enabled, isSignedIn, connect, disconnect]);

  const declineInvite = useCallback((inviteId: string) => {
    sendMessage({ type: 'friend_invite_response', invite_id: inviteId, action: 'decline' });
  }, [sendMessage]);

  return { isConnected, declineInvite };
};
