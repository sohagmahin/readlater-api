import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { createUser, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("tags", () => {
  it("normalizes, de-duplicates and attaches tags", async () => {
    const u = await createUser();
    const bm = await request(app).post("/bookmarks").set(u.auth).send({ url: "https://example.com/t" });

    const res = await request(app)
      .post(`/bookmarks/${bm.body.id}/tags`)
      .set(u.auth)
      .send({ tags: ["NodeJS", "backend", "nodejs"] });

    expect(res.status).toBe(200);
    expect(res.body.map((t: { name: string }) => t.name).sort()).toEqual(["backend", "nodejs"]);

    const again = await request(app).post(`/bookmarks/${bm.body.id}/tags`).set(u.auth).send({ tags: ["nodejs"] });
    expect(again.status).toBe(200);

    const tags = await request(app).get("/tags").set(u.auth);
    expect(tags.body).toHaveLength(2);
  });

  it("lists bookmarks with their tags and filters by tag", async () => {
    const u = await createUser();
    const a = await request(app).post("/bookmarks").set(u.auth).send({ url: "https://example.com/a" });
    await request(app).post("/bookmarks").set(u.auth).send({ url: "https://example.com/b" });
    await request(app).post(`/bookmarks/${a.body.id}/tags`).set(u.auth).send({ tags: ["go"] });

    const filtered = await request(app).get("/bookmarks?tag=go").set(u.auth);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].tags.map((t: { name: string }) => t.name)).toEqual(["go"]);

    const none = await request(app).get("/bookmarks?tag=missing").set(u.auth);
    expect(none.body.items).toEqual([]);
  });

  it("cannot tag someone else's bookmark, and tags stay private", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const bm = await request(app).post("/bookmarks").set(owner.auth).send({ url: "https://example.com/o" });

    const res = await request(app).post(`/bookmarks/${bm.body.id}/tags`).set(intruder.auth).send({ tags: ["hacked"] });
    expect(res.status).toBe(404);

    const theirTags = await request(app).get("/tags").set(intruder.auth);
    expect(theirTags.body).toEqual([]);
  });
});