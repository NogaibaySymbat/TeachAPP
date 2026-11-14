import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingIncludes: { "/*": ["./content/**/*"] },
};

export default config;
