import { redirect } from 'next/navigation';
import { currentAccess } from '../lib/auth/access';
import Organization from './organization';

export default async function Home() {
  const session = await currentAccess();
  if (!session) redirect('/login');
  const permissions = session.profile.permissions;
  if (!permissions.some(p => ['reservations.read','missions.read','stats.read','settings.write','users.manage'].includes(p)) && permissions.includes('kitchen.read')) redirect('/cocina');
  return <Organization permissions={permissions} />;
}
