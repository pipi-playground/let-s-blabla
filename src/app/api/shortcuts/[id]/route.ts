import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_RECIPIENTS } from "@/lib/utils/message";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  if (recipientIds.length > 0) {
    const { data: friendRows } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("owner_id", user.id)
      .in("friend_id", recipientIds);
    const validIds = new Set((friendRows ?? []).map((f) => f.friend_id));
    if (recipientIds.some((rid) => !validIds.has(rid))) {
      return NextResponse.json({ error: "친구 목록에 없는 상대가 포함되어 있어요." }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("shortcuts")
    .update({ name, message_template: messageTemplate, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: clearError } = await supabase
    .from("shortcut_recipients")
    .delete()
    .eq("shortcut_id", id);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  if (recipientIds.length > 0) {
    const { error: insertError } = await supabase
      .from("shortcut_recipients")
      .insert(recipientIds.map((friendId) => ({ shortcut_id: id, friend_id: friendId })));
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { error } = await supabase.from("shortcuts").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
