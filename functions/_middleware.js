// singer-tube.pomyjo.com → choeae-plaza.pomyjo.com 리다이렉트
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'singer-tube.pomyjo.com') {
    return Response.redirect('https://choeae-plaza.pomyjo.com' + url.pathname + url.search, 301);
  }
  // Serve the shared application at the separate trot entry point, without
  // redirecting its address back to the idol home or rewriting API routes.
  if (['/trot/','/discover/'].includes(url.pathname)) {
    url.pathname = url.pathname.slice(0,-1);
    return Response.redirect(url.href, 308);
  }
  let response;
  if (['/trot','/discover'].includes(url.pathname) && ['GET', 'HEAD'].includes(context.request.method)) {
    const asset = new URL('/', url);
    asset.search = url.search;
    response = await context.next(new Request(asset, context.request));
  } else {
    response = await context.next();
  }
  if(url.pathname==='/discover'&&context.request.method==='GET'&&response.status===200){
    // Naver search output must not share a page with advertising. Keep the
    // existing root publisher installation; remove it server-side here only.
    let html=await response.text();
    html=html.replace(/<script\b[^>]*\bsrc=["']https:\/\/pagead2\.googlesyndication\.com\/[\s\S]*?<\/script>/gi,'');
    if(/googlesyndication\.com|adsbygoogle/i.test(html)||!/<html\b/i.test(html))return new Response('Discovery page unavailable',{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    html=html.replace(/<html\b/,'<html data-blog-enabled="true"');
    response=new Response(html,{status:response.status,headers:response.headers});
  }
  const headers = new Headers(response.headers);
  // Owned app code must revalidate after a deployment. Versioned entry URLs
  // also evict code cached by visitors before this policy existed.
  if (['/', '/trot','/discover'].includes(url.pathname) || /\.(?:js|css)$/.test(url.pathname)) headers.set('Cache-Control', 'no-cache');
  if(url.pathname==='/discover')headers.set('X-Robots-Tag','noindex, nofollow');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
