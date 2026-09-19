// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    {
        rules: {
            "no-console": "warn",
            "@typescript-eslint/consistent-type-definitions": "off",

            // The base rule double-reports with the TS-aware one; keep only
            // the latter so a single unused variable is not two errors.
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    // A leading underscore marks a deliberate discard — e.g.
                    // pulling `vendorId` out of a query object so it is not
                    // applied twice, or stripping payout bank details from a
                    // response.
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
    {
        // Ambient module declarations describe someone else's API: parameter
        // names are documentation, and `any` is sometimes the honest type.
        files: ["**/*.d.ts"],
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-explicit-any": "off",
        },
    }
);
