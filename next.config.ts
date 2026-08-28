import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Корень проекта (иначе Turbopack поднимается до домашней папки из-за lock-файла)
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
