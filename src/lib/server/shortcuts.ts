import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { MAX_RECIPIENTS } from "@/lib/utils/message";
import type { ShortcutListItem } from "@/types/app";

const RPC_ERRORS: Record<string, { message: string; status: number }> = {
  too_many_recipients: { message: `기본 전송 대상은 최대 ${MAX_RECIPIENTS}명이에요.`, status: 400 },
  not_friend: { message: "친구 목록에 없는 상대가 포함되어 있어요.", status: 400 },
  not_found: { message: "단축버튼을 찾을 수 없어요.", status: 404 },
};

/**
 * 단축버튼 생성(id=null)/수정을 save_shortcut RPC 한 번으로 처리하고,
 * 화면에서 바로 쓸 수 있는 단축버튼 객체를 응답한다.
 */
export async function saveShortcut(
  supabase: SupabaseClient<Database>,
  id: string | null,
  request: Request
) {
  const body = await request.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const messageTemplate = (body?.messageTemplate ?? "").trim();
  const recipientIds: string[] = Array.isArray(body?.recipientIds) ? body.recipientIds : [];

  if (!name) return NextResponse.json({ error: "버튼 이름을 입력해주세요." }, { status: 400 });
  if (!messageTemplate) return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  if (recipientIds.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `기본 전송 대상은 최대 ${MAX_RECIPIENTS}명이에요.` }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("save_shortcut", {
    p_id: id,
    p_name: name,
    p_message_template: messageTemplate,
    p_recipient_ids: recipientIds,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as unknown as ShortcutListItem | { error: string };
  if ("error" in result) {
    const mapped = RPC_ERRORS[result.error] ?? { message: "저장에 실패했어요.", status: 500 };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json({ shortcut: result });
}
