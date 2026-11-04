export interface FriendListItem {
  id: string; // friends.id
  friendId: string; // profiles.id
  nickname: string;
  memberCode: string;
  createdAt: string;
  muted: boolean;
}

export interface ShortcutRecipient {
  friendId: string;
  nickname: string;
}

export interface ShortcutListItem {
  id: string;
  name: string;
  messageTemplate: string;
  cooldownSeconds: number;
  lastSentAt: string | null;
  createdAt: string;
  defaultRecipients: ShortcutRecipient[];
}

export type SendStatus = "sent" | "muted" | "dnd" | "failed" | "no_subscription";

export interface SendResult {
  recipientId: string;
  nickname: string;
  status: SendStatus;
}

export interface FriendRequestItem {
  id: string; // friend_requests.id
  userId: string; // 상대 profiles.id
  nickname: string;
  memberCode: string;
  createdAt: string;
}

export interface FriendRequestsResponse {
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}

export interface HistoryItem {
  id: string;
  counterpartId: string;
  counterpartNickname: string;
  message: string;
  status: SendStatus;
  createdAt: string;
}

export interface Profile {
  nickname: string;
  member_code: string;
}
