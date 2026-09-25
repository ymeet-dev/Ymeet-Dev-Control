import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 'server-only' só resolve para um módulo vazio dentro do pipeline de build do Next.js
// (condição de export "react-server"); em Node puro (Vitest) ele lança erro sempre.
// O mock reproduz aqui o comportamento de servidor, sem alterar a proteção real em build.
vi.mock('server-only', () => ({}));

const { createSupabaseAdminClient, createSupabaseClient, createBrowserSupabaseClient, createServerSupabaseClient } =
  await import('./index');

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

describe('createSupabaseClient', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('lança erro quando NEXT_PUBLIC_SUPABASE_URL está ausente', () => {
    expect(() => createSupabaseClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('lança erro quando NEXT_PUBLIC_SUPABASE_ANON_KEY está ausente', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    expect(() => createSupabaseClient()).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('cria o client quando as variáveis estão presentes', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(() => createSupabaseClient()).not.toThrow();
  });

  it('createSupabaseAdminClient lança erro quando SUPABASE_SERVICE_ROLE_KEY está ausente', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    expect(() => createSupabaseAdminClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('createSupabaseAdminClient cria o client quando as variáveis estão presentes', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    expect(() => createSupabaseAdminClient()).not.toThrow();
  });

  it('createBrowserSupabaseClient lança erro quando NEXT_PUBLIC_SUPABASE_URL está ausente', () => {
    expect(() => createBrowserSupabaseClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('createBrowserSupabaseClient cria o client quando as variáveis estão presentes', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(() => createBrowserSupabaseClient()).not.toThrow();
  });

  it('createServerSupabaseClient lança erro quando NEXT_PUBLIC_SUPABASE_URL está ausente', () => {
    expect(() => createServerSupabaseClient({ getAll: () => [] })).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('createServerSupabaseClient cria o client quando as variáveis e os cookies estão presentes', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(() => createServerSupabaseClient({ getAll: () => [] })).not.toThrow();
  });
});
