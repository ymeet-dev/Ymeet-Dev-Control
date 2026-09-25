import { getCurrentUser } from '../lib/auth/get-current-user';
import { signOut } from './login/actions';

export default async function HomePage() {
  const currentUser = await getCurrentUser();

  return (
    <main>
      <h1>Ymeet Dev Control</h1>
      <p>Fase 1 — base do projeto em construção.</p>
      {currentUser ? (
        <section>
          <p>
            Logado como {currentUser.email ?? currentUser.id} — papel: {currentUser.role}
          </p>
          <form action={signOut}>
            <button type="submit">Sair</button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
