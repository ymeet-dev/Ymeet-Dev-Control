import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ymeet Dev Control',
  description: 'Plataforma de orquestração de desenvolvimento assistido por agentes de IA.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
