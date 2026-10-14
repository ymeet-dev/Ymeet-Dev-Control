import { signIn } from './actions';
import styles from './login.module.css';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, redirectTo } = await searchParams;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Entrar</h1>
        {error ? (
          <p role="alert" className={styles.errorBanner}>
            {error}
          </p>
        ) : null}
        <form action={signIn} className={styles.form}>
          <input type="hidden" name="redirectTo" value={redirectTo ?? '/'} />
          <div className={styles.field}>
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" name="email" required autoComplete="email" />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" name="password" required autoComplete="current-password" />
          </div>
          <button type="submit" className={styles.submit}>
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
