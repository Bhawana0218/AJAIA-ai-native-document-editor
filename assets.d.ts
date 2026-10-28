// Type declarations for assets that Next.js handles at build time.
declare module "*.css";

declare module "*.svg" {
  const content: unknown;
  export default content;
}
