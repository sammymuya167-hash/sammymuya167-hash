import { redirect } from "next/navigation";
import { officeIdentity } from "../../lib/accounts";
import LoginScreen from "./screen";
import { loginReturnPath } from "../../lib/login-path";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{returnTo?:string}>}){const params=await searchParams;const returnTo=loginReturnPath(params.returnTo);if(await officeIdentity())redirect(returnTo);return <LoginScreen returnTo={returnTo}/>;}
