import type { ProfileRole } from 'database';

/**
 * Base para o controle de permissões do painel (Fase 1+): verifica se um papel
 * está entre os permitidos para uma ação. As regras específicas de cada tela/ação
 * serão adicionadas quando o painel for implementado.
 */
export function hasRole(role: ProfileRole | null | undefined, allowed: ProfileRole[]): boolean {
  return !!role && allowed.includes(role);
}
