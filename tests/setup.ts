if (!process.env.DATABASE_URL?.endsWith("_test")) {
  throw new Error("Refusing to run tests: DATABASE_URL must point to a *_test database");
}