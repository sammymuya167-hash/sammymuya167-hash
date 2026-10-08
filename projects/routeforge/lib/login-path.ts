export function loginReturnPath(value?:string){
  if(!value?.startsWith("/")||value.includes("\\"))return "/";
  try{const url=new URL(value,"https://routeforge.invalid");return url.origin==="https://routeforge.invalid"&&url.pathname!=="/login"?url.pathname+url.search+url.hash:"/";}catch{return "/";}
}
