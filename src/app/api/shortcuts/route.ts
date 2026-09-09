import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_RECIPIENTS } from "@/lib/utils/message";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: shortcuts, error } = await supabase
    .from("shortcuts")
    .select(
      "id, name, message_template, cooldown_seconds, last_sent_at, created_at, shortcut_recipients(friend_id, friend:profiles!shortcut_recipients_friend_id_fkey(nickname))"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (shortcuts ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    messageTemplate: s.message_template,
    cooldownSeconds: s.cooldown_seconds,
    lastSentAt: s.last_sent_at,
    createdAt: s.created_at,
    defaultRecipients: (s.shortcut_recipients ?? []).map((r) => ({
      friendId: r.friend_id,
      nickname: (r.friend as unknown as { nickname: string })?.nickname,
    })),
  }));

  return NextResponse.json({ shortcuts: result });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const messageTemplate = (body?.messageTemplate ?? "").trim();
  const recipientIds: string[] = Array.isArray(body?.recipientIds) ? body.recipientIds : [];

  if (!name) return NextResponse.json({ error: "버튼 이름을 입력해주세요." }, { status: 400 });
  if (!messageTemplate) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  if (recipientIds.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `기본 전송 대상은 최대 ${MAX_RECIPIENTS}명이에요.` }, { status: 400 });
  }

  const { data: shortcut, error } = await supabase
    .from("shortcuts")
    .insert({ owner_id: user.id, name, message_template: messageTemplate })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (recipientIds.length > 0) {
    const { error: recipientsError } = await supabase
      .from("shortcut_recipients")
      .insert(recipientIds.map((friendId) => ({ shortcut_id: shortcut.id, friend_id: friendId })));
    if (recipientsError) {
      return NextResponse.json({ error: recipientsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: shortcut.id });
}
