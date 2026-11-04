// supabase/migrations/0001_init.sql + 0002 스키마에 대응하는 수기 타입 정의.
// 스키마가 바뀌면 `supabase gen types typescript`로 재생성하는 것을 권장.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
        Relationships: [
          {
            foreignKeyName: "send_logs_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "send_logs_recipient_id_fkey";
            columns: ["recipient_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friend_requests: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friend_requests_requester_id_fkey";
            columns: ["requester_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friend_requests_addressee_id_fkey";
            columns: ["addressee_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      send_friend_request: {
        Args: { p_member_code: string };
        Returns: Json;
      };
      accept_friend_request: {
        Args: { p_request_id: string };
        Returns: string | null;
      };
      save_shortcut: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_message_template: string;
          p_recipient_ids: string[];
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
