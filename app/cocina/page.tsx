import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { currentAccess } from '../../lib/auth/access';
import { KitchenPanel } from '../../components/kitchen-panel';
import { KitchenProfile } from '../../components/kitchen-profile';

export default async function KitchenPage() {
  const session = await currentAccess();
  if (!session) redirect('/login');
  if (!session.profile.permissions.includes('kitchen.read')) redirect('/');
  return <main className="kitchen-home"><header className="kitchen-welcome"><div className="kitchen-welcome-copy"><Image className="kitchen-logo" src="/cca-logo.png" priority alt="Congregación Cristiana en la Argentina · CCA Sector 7" width={227} height={114}/><p className="eyebrow">CCA SECTOR 7 · EQUIPO DE COCINA</p><h1>Un encuentro,<br/>mucho para compartir.</h1><p className="subtitle">Tus compromisos de cocina, en un solo lugar.<br/>Gracias por servir con tanto cariño.</p>{session.profile.permissions.includes('reservations.read') && <Link className="kitchen-back" href="/">Volver a organización</Link>}</div><KitchenProfile name={session.profile.full_name} username={session.profile.username}/></header><KitchenPanel canPrepare={session.profile.permissions.includes('reservations.write')} canConfirm={session.profile.permissions.includes('kitchen.confirm')} /><footer className="kitchen-footer">Congregación Cristiana en la Argentina · Sector 7</footer></main>;
}
