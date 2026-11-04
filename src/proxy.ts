import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims()는 JWT를 로컬에서 검증하므로 탭 이동마다 Auth 서버 왕복이 생기지 않는다.
  // (만료된 경우에만 refresh 요청이 발생하고, 갱신된 쿠키는 위 setAll로 응답에 실린다.)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // /api/*는 각 라우트 핸들러가 자체적으로 인증을 검사하므로 제외한다.
    // (여기서 한 번 더 검사하면 요청마다 getUser() 네트워크 왕복이 중복으로 발생한다.)
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
