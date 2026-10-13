import { officeIdentity } from '../../lib/accounts';
import LoginScreen from '../login/screen';
import MerchantWorkspace from './workspace';
export const dynamic='force-dynamic';
export default async function MerchantPage(){if(!await officeIdentity())return <LoginScreen returnTo="/merchant"/>;return <MerchantWorkspace/>;}
