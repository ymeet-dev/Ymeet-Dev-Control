/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'database' é consumido como fonte TS do workspace (não um pacote pré-compilado);
  // o Next.js precisa transpilá-lo explicitamente.
  transpilePackages: ['database'],
};

export default nextConfig;
