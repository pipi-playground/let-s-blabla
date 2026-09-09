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
