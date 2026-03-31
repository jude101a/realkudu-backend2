import dotenv from "dotenv";

const hasRuntimeConfig = Boolean(
  process.env.DATABASE_URL && process.env.JWT_SECRET
);

if (!hasRuntimeConfig) {
  dotenv.config({ quiet: true });
}

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
};
