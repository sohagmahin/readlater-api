import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("docs", () => {
  it("serves an OpenAPI spec that covers every route", async () => {
    const res = await request(app).get("/docs/openapi.json");
    expect(res.status).toBe(200);

    const operations = Object.entries(res.body.paths as Record<string, object>).flatMap(([path, item]) =>
      Object.keys(item)
        .filter((k) => k !== "parameters")
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(operations.sort()).toEqual(
      [
        "GET /health",
        "POST /auth/register",
        "POST /auth/login",
        "POST /auth/refresh",
        "GET /bookmarks",
        "POST /bookmarks",
        "GET /bookmarks/{id}",
        "PATCH /bookmarks/{id}",
        "DELETE /bookmarks/{id}",
        "POST /bookmarks/{id}/tags",
        "DELETE /bookmarks/{id}/tags/{tagId}",
        "GET /tags",
      ].sort(),
    );
  });

  it("builds request schemas from the zod validators", async () => {
    const res = await request(app).get("/docs/openapi.json");
    const register = res.body.paths["/auth/register"].post.requestBody.content["application/json"].schema;
    expect(register.required).toEqual(["email", "password"]);
    expect(register.properties.password).toMatchObject({ minLength: 8, maxLength: 72 });

    const limit = res.body.paths["/bookmarks"].get.parameters.find((p: { name: string }) => p.name === "limit");
    expect(limit.schema).toMatchObject({ default: 20, maximum: 100 });
  });

  it("serves the Scalar reference at /docs without auth", async () => {
    const res = await request(app).get("/docs");
    expect(res.status).toBe(200);
    expect(res.text).toContain("ReadLater API Docs");
    expect(res.text).toContain("/docs/openapi.json");
    expect(res.text).toContain("@scalar/api-reference@1.74.0");
  });
});
