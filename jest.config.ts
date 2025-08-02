import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  testMatch: ["<rootDir>/**/__tests__/**/*.test.ts", "<rootDir>/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  collectCoverageFrom: ["**/*.ts", "!**/*.d.ts", "!**/node_modules/**", "!jest.config.ts"],
  coverageDirectory: "coverage",
};

module.exports = config;
