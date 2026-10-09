import Link from 'next/link';
import { networkActor } from '../../../lib/network-access';
import { TrackingError } from '../../../lib/tracking';
import LoginScreen from '../../login/screen';
import AdminWorkspace from './workspace';
export const dynamic='force-dynamic';
export default async function AdminPage(){
  let denied=0;
  try{await networkActor('admin');}catch(e){if(e instanceof TrackingError&&[401,403].includes(e.status))denied=e.status;else throw e;}
  if(denied===401)return <LoginScreen returnTo="/admin/network"/>;
  if(denied===403)return <main className="login-page"><section className="network-card"><h1>Platform administrator access required.</h1><p>Your account can continue using its authorized merchant workspace.</p><Link href="/merchant" className="tracking-primary">Open merchant hub</Link></section></main>;
  return <AdminWorkspace/>;
}
