import { redirect } from 'next/navigation';
import { currentAccess } from '../lib/auth/access';
import Organization from './organization';

export default async function Home() {
  const session = await currentAccess();
  if (!session) redirect('/login');
  if (session.profile.role === 'kitchen') redirect('/cocina');
  return <Organization />;
}
