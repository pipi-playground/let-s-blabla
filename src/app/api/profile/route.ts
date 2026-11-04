import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";

export async function GET() {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const { data, error } = await supabase
    .from("profiles")
    .select("nickname, member_code")
    .eq("id", userId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const nickname = (body?.nickname ?? "").trim();

  if (!nickname) return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
  if (nickname.length > 20) {
    return NextResponse.json({ error: "닉네임은 20자 이하로 입력해주세요." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update({ nickname }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
