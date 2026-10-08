// singer-tube.pomyjo.com → choeae-plaza.pomyjo.com 리다이렉트
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'singer-tube.pomyjo.com') {
    return Response.redirect('https://choeae-plaza.pomyjo.com' + url.pathname + url.search, 301);
  }
  // Serve the shared application at the separate trot entry point, without
  // redirecting its address back to the idol home or rewriting API routes.
  if (url.pathname === '/trot/') {
    url.pathname = '/trot';
    return Response.redirect(url.href, 308);
  }
  let response;
  if (url.pathname === '/trot' && ['GET', 'HEAD'].includes(context.request.method)) {
    const asset = new URL('/', url);
    asset.search = url.search;
    response = await context.next(new Request(asset, context.request));
  } else {
    response = await context.next();
  }
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
