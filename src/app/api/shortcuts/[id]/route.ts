import { NextResponse } from "next/server";
import { getAuthedClient, unauthorized } from "@/lib/supabase/auth";
import { saveShortcut } from "@/lib/server/shortcuts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();
  return saveShortcut(supabase, id, request);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getAuthedClient();
  if (!userId) return unauthorized();

  const { error } = await supabase.from("shortcuts").delete().eq("id", id).eq("owner_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
