import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("nickname, member_code")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const nickname = (body?.nickname ?? "").trim();

  if (!nickname) return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
  if (nickname.length > 20) {
    return NextResponse.json({ error: "닉네임은 20자 이하로 입력해주세요." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update({ nickname }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
