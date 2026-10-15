/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@langchain/langgraph", "@langchain/core", "@langchain/groq"],
};
export default nextConfig;
