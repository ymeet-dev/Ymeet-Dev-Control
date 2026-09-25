import { signIn } from './actions';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, redirectTo } = await searchParams;

  return (
    <main>
      <h1>Entrar</h1>
      {error ? <p role="alert">{error}</p> : null}
      <form action={signIn}>
        <input type="hidden" name="redirectTo" value={redirectTo ?? '/'} />
        <div>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" name="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" name="password" required autoComplete="current-password" />
        </div>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
