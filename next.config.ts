import type { NextConfig } from 'next';
import withPWA from '@ducanh2912/next-pwa';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Empty turbopack config to silence webpack/turbopack warning
  turbopack: {},
};

export default withPWA({
  dest: 'public',
  register: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
