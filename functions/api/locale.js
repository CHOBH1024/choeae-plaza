import {selectLocale} from '../../public/locale-core.js';
export async function onRequestGet({request}){
  // Only platform country metadata is trusted. Never echo/log visitor IP or country.
  return Response.json(selectLocale(request.cf?.country,request.headers.get('Accept-Language')||''),{headers:{'Cache-Control':'no-store'}});
}
