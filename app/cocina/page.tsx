import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentAccess } from '../../lib/auth/access';
import { KitchenPanel } from '../../components/kitchen-panel';
import { UserMenu } from '../../components/user-menu';

export default async function KitchenPage() {
  const session = await currentAccess();
  if (!session) redirect('/login');
  return <main className="kitchen-home"><header><div><p className="eyebrow">CCA SECTOR 7 · EQUIPO DE COCINA</p><h1>Compromisos de cocina</h1><p className="subtitle">Lo previsto y lo que realmente compartimos.</p></div><div>{session.profile.role === 'member' && <Link href="/">Volver a organización</Link>}<UserMenu /></div></header><KitchenPanel canPrepare={session.profile.role === 'member'} /></main>;
}
