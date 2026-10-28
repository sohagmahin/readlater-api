import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("auth", () => {
  it("registers a user and never returns the password hash", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@test.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("a@test.com");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("rejects duplicate email with 409", async () => {
    const body = { email: "dup@test.com", password: "password123" };
    await request(app).post("/auth/register").send(body);
    const res = await request(app).post("/auth/register").send(body);
    expect(res.status).toBe(409);
  });

  it("rejects short passwords with 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "b@test.com", password: "123" });
    expect(res.status).toBe(400);
  });

  it("logs in and rejects a wrong password with the same message as unknown email", async () => {
    await request(app).post("/auth/register").send({ email: "c@test.com", password: "password123" });

    const ok = await request(app).post("/auth/login").send({ email: "c@test.com", password: "password123" });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();

    const wrongPw = await request(app).post("/auth/login").send({ email: "c@test.com", password: "wrongpass1" });
    const noUser = await request(app).post("/auth/login").send({ email: "nobody@test.com", password: "wrongpass1" });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error).toBe(noUser.body.error);
  });

  it("refresh token cannot be used as an access token", async () => {
    await request(app).post("/auth/register").send({ email: "d@test.com", password: "password123" });
    const login = await request(app).post("/auth/login").send({ email: "d@test.com", password: "password123" });

    const res = await request(app)
      .get("/bookmarks")
      .set("Authorization", `Bearer ${login.body.refreshToken}`);
    expect(res.status).toBe(401);
  });

  it("protected routes require a token", async () => {
    const res = await request(app).get("/bookmarks");
    expect(res.status).toBe(401);
  });
});