import Link from 'next/link';
import { getCurrentUser } from '../../lib/auth/get-current-user';
import { signOut } from '../../app/login/actions';

export async function AppHeader() {
  const currentUser = await getCurrentUser();

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
      <Link href="/">Ymeet Dev Control</Link>
      {currentUser ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
          <span>
            {currentUser.email ?? currentUser.id} — {currentUser.role}
          </span>
          <form action={signOut}>
            <button type="submit">Sair</button>
          </form>
        </div>
      ) : null}
    </header>
  );
}
