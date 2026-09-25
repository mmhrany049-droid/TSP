export const API = '/api/v1';
export function token() { if (typeof window === 'undefined') return ''; return localStorage.getItem('tsp_token') || ''; }
export async function request<T=any>(path:string, options:RequestInit={}) : Promise<T> {
  const headers = new Headers(options.headers); if (!(options.body instanceof FormData)) headers.set('Content-Type','application/json');
  const auth=token(); if(auth) headers.set('Authorization',`Bearer ${auth}`);
  const response=await fetch(`${API}${path}`,{...options,headers,cache:'no-store'});
  let data:any={}; try { data=await response.json(); } catch {}
  if(!response.ok) throw new Error(typeof data.detail==='string'?data.detail:'در ارتباط با سامانه مشکلی پیش آمد');
  return data as T;
}
export function saveToken(value:string){localStorage.setItem('tsp_token',value)}
export function clearToken(){localStorage.removeItem('tsp_token')}
