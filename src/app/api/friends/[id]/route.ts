import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: deleted, error } = await supabase
    .from("friends")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("friend_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "친구를 찾을 수 없어요." }, { status: 404 });

  // 삭제한 친구가 내 단축버튼의 기본 전송 대상으로 설정되어 있었다면 함께 정리
  const { data: myShortcuts } = await supabase.from("shortcuts").select("id").eq("owner_id", user.id);
  const shortcutIds = (myShortcuts ?? []).map((s) => s.id);

  if (shortcutIds.length > 0) {
    await supabase
      .from("shortcut_recipients")
      .delete()
      .eq("friend_id", deleted.friend_id)
      .in("shortcut_id", shortcutIds);
  }

  return NextResponse.json({ ok: true });
}
