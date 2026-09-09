// supabase/migrations/0001_init.sql 스키마에 대응하는 수기 타입 정의.
// 스키마가 바뀌면 `supabase gen types typescript`로 재생성하는 것을 권장.

export type SendLogStatus = "sent" | "muted" | "dnd" | "failed" | "no_subscription";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          member_code: string;
          created_at: string;
        };
        Insert: {
          id: string;
          nickname?: string;
          member_code?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string;
          member_code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      friends: {
        Row: {
          id: string;
          owner_id: string;
          friend_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          friend_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          friend_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friends_friend_id_fkey";
            columns: ["friend_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friends_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shortcuts: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          message_template: string;
          cooldown_seconds: number;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          message_template: string;
          cooldown_seconds?: number;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          message_template?: string;
          cooldown_seconds?: number;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shortcut_recipients: {
        Row: {
          shortcut_id: string;
          friend_id: string;
        };
        Insert: {
          shortcut_id: string;
          friend_id: string;
        };
        Update: {
          shortcut_id?: string;
          friend_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shortcut_recipients_friend_id_fkey";
            columns: ["friend_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shortcut_recipients_shortcut_id_fkey";
            columns: ["shortcut_id"];
            referencedRelation: "shortcuts";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      mutes: {
        Row: {
          muter_id: string;
          muted_id: string;
          created_at: string;
        };
        Insert: {
          muter_id: string;
          muted_id: string;
          created_at?: string;
        };
        Update: {
          muter_id?: string;
          muted_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dnd_settings: {
        Row: {
          user_id: string;
          enabled: boolean;
          start_time: string;
          end_time: string;
          timezone: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          start_time?: string;
          end_time?: string;
          timezone?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          start_time?: string;
          end_time?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      send_logs: {
        Row: {
          id: string;
          shortcut_id: string | null;
          sender_id: string;
          recipient_id: string;
          message: string;
          status: SendLogStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          shortcut_id?: string | null;
          sender_id: string;
          recipient_id: string;
          message: string;
          status: SendLogStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          shortcut_id?: string | null;
          sender_id?: string;
          recipient_id?: string;
          message?: string;
          status?: SendLogStatus;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
