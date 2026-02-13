import antfu from "@antfu/eslint-config";

export default antfu({
  type: "lib",
  typescript: true,
  stylistic: {
    indent: 2,
    quotes: "double",
    semi: true,
  },
  ignores: [
    "dist/**",
    "node_modules/**",
  ],
  rules: {
    "no-console": "off",
    "ts/no-explicit-any": "warn",
  },
});
