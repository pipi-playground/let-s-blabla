import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  const p256dh = body?.keys?.p256dh as string | undefined;
  const auth = body?.keys?.auth as string | undefined;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "구독 정보가 올바르지 않아요." }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (!endpoint) return NextResponse.json({ error: "endpoint가 필요해요." }, { status: 400 });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
