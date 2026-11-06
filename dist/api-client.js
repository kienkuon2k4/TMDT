let csrf=null;
export async function api(path,{method='GET',body,headers={}}={}){
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&csrf?{'X-CSRF-Token':csrf}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok){const error=new Error(data.error||'Yêu cầu thất bại.');error.status=response.status;throw error;}if(Object.hasOwn(data,'csrf'))csrf=data.csrf;return data;
}
