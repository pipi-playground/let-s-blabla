import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";
import { saveShortcut } from "@/lib/server/shortcuts";

export async function GET() {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const [{ data: shortcuts, error }, { data: friendRows }] = await Promise.all([
    supabase
      .from("shortcuts")
      .select(
        "id, name, message_template, cooldown_seconds, last_sent_at, created_at, shortcut_recipients(friend_id, friend:profiles!shortcut_recipients_friend_id_fkey(nickname))"
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("friends").select("friend_id").eq("owner_id", userId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 이미 삭제된(더 이상 친구가 아닌) 상대는 기본 전송 대상에서 제외
  const currentFriendIds = new Set((friendRows ?? []).map((f) => f.friend_id));

  const result = (shortcuts ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    messageTemplate: s.message_template,
    cooldownSeconds: s.cooldown_seconds,
    lastSentAt: s.last_sent_at,
    createdAt: s.created_at,
    defaultRecipients: (s.shortcut_recipients ?? [])
      .filter((r) => currentFriendIds.has(r.friend_id))
      .map((r) => ({
        friendId: r.friend_id,
        nickname: (r.friend as unknown as { nickname: string })?.nickname,
      })),
  }));

  return NextResponse.json({ shortcuts: result });
}

export async function POST(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();
  return saveShortcut(supabase, null, request);
}
