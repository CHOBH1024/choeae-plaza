// singer-tube.pomyjo.com → choeae-plaza.pomyjo.com 리다이렉트
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'singer-tube.pomyjo.com') {
    return Response.redirect('https://choeae-plaza.pomyjo.com' + url.pathname + url.search, 301);
  }
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
