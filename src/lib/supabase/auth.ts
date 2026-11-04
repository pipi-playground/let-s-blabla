import { NextResponse } from "next/server";
import { createClient } from "./server";

/**
 * 요청 쿠키의 세션으로 Supabase 클라이언트를 만들고 로그인 사용자 id를 돌려준다.
 *
 * getUser()는 매 요청마다 Supabase Auth 서버로 네트워크 왕복을 하지만,
 * getClaims()는 JWT 서명을 로컬에서 검증한다(비대칭 JWT 서명 키 사용 시, JWKS는 캐시됨).
 * 레거시 대칭키(HS256) 프로젝트에서는 내부적으로 getUser()로 폴백하므로 보안 수준은 동일하다.
 */
export async function getAuthedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  return { supabase, userId };
}

export function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
}
