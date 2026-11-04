import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";

export async function GET() {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const { data, error } = await supabase
    .from("dnd_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    settings: data ?? {
      user_id: userId,
      enabled: false,
      start_time: "23:00",
      end_time: "08:00",
      timezone: "Asia/Seoul",
    },
  });
}

export async function PUT(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const enabled = Boolean(body?.enabled);
  const startTime = body?.startTime as string | undefined;
  const endTime = body?.endTime as string | undefined;

  if (!/^\d{2}:\d{2}$/.test(startTime ?? "") || !/^\d{2}:\d{2}$/.test(endTime ?? "")) {
    return NextResponse.json({ error: "시간 형식이 올바르지 않아요 (HH:mm)." }, { status: 400 });
  }

  const { error } = await supabase.from("dnd_settings").upsert(
    {
      user_id: userId,
      enabled,
      start_time: startTime,
      end_time: endTime,
      timezone: "Asia/Seoul",
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
