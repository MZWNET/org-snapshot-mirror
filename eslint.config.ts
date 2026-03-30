import type { TypedFlatConfigItem } from "@antfu/eslint-config";
import type { FlatConfigComposer } from "eslint-flat-config-utils";
import antfu from "@antfu/eslint-config";

const config: FlatConfigComposer<TypedFlatConfigItem> = antfu({
  type: "lib",
  typescript: {
    tsconfigPath: "tsconfig.json",
  },
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

export default config;
