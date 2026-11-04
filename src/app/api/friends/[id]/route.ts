import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const { data: deleted, error } = await supabase
    .from("friends")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId)
    .select("friend_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted) return NextResponse.json({ error: "친구를 찾을 수 없어요." }, { status: 404 });

  // 삭제한 친구가 내 단축버튼의 기본 전송 대상이었다면 함께 정리.
  // shortcut_recipients RLS가 "내 단축버튼"으로 범위를 제한하므로 shortcut id 조회 없이 바로 삭제한다.
  await supabase.from("shortcut_recipients").delete().eq("friend_id", deleted.friend_id);

  return NextResponse.json({ ok: true });
}
