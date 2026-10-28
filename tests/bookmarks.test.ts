import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { createUser, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("bookmarks", () => {
  it("creates a bookmark, and saving the same url again returns 200 without a duplicate", async () => {
    const u = await createUser();
    const url = "https://example.com/a";

    const first = await request(app).post("/bookmarks").set(u.auth).send({ url });
    const second = await request(app).post("/bookmarks").set(u.auth).send({ url });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const list = await request(app).get("/bookmarks").set(u.auth);
    expect(list.body.items).toHaveLength(1);
  });

  it("rejects non-http urls", async () => {
    const u = await createUser();
    const res = await request(app).post("/bookmarks").set(u.auth).send({ url: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("another user gets 404 on read, update and delete, and the bookmark survives", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const created = await request(app).post("/bookmarks").set(owner.auth).send({ url: "https://example.com/private" });
    const id = created.body.id;

    expect((await request(app).get(`/bookmarks/${id}`).set(intruder.auth)).status).toBe(404);
    expect(
      (await request(app).patch(`/bookmarks/${id}`).set(intruder.auth).send({ status: "read" })).status,
    ).toBe(404);
    expect((await request(app).delete(`/bookmarks/${id}`).set(intruder.auth)).status).toBe(404);

    const still = await request(app).get(`/bookmarks/${id}`).set(owner.auth);
    expect(still.status).toBe(200);
    expect(still.body.status).toBe("unread");
  });

  it("intruder's list never contains the owner's bookmarks", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    await request(app).post("/bookmarks").set(owner.auth).send({ url: "https://example.com/x" });

    const res = await request(app).get("/bookmarks").set(intruder.auth);
    expect(res.body.items).toEqual([]);
  });

  it("filters by status", async () => {
    const u = await createUser();
    const a = await request(app).post("/bookmarks").set(u.auth).send({ url: "https://example.com/1" });
    await request(app).post("/bookmarks").set(u.auth).send({ url: "https://example.com/2" });
    await request(app).patch(`/bookmarks/${a.body.id}`).set(u.auth).send({ status: "read" });

    const unread = await request(app).get("/bookmarks?status=unread").set(u.auth);
    expect(unread.body.items).toHaveLength(1);
    expect(unread.body.items[0].url).toBe("https://example.com/2");
  });

  it("cache is invalidated after an update", async () => {
    const u = await createUser();
    const a = await request(app).post("/bookmarks").set(u.auth).send({ url: "https://example.com/c" });

    const before = await request(app).get("/bookmarks?status=unread").set(u.auth); // cache ভরে
    expect(before.body.items).toHaveLength(1);

    await request(app).patch(`/bookmarks/${a.body.id}`).set(u.auth).send({ status: "read" });

    const after = await request(app).get("/bookmarks?status=unread").set(u.auth);
    expect(after.body.items).toHaveLength(0);
  });

  it("paginates with a cursor: no duplicates, nothing skipped, ends with null", async () => {
    const u = await createUser();
    for (let i = 1; i <= 25; i++) {
      await request(app).post("/bookmarks").set(u.auth).send({ url: `https://example.com/p/${i}` });
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const url: string = `/bookmarks?limit=10${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await request(app).get(url).set(u.auth);
      expect(res.status).toBe(200);
      seen.push(...res.body.items.map((b: { url: string }) => b.url));
      cursor = res.body.nextCursor;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });

  it("rejects a garbage cursor with 400", async () => {
    const u = await createUser();
    const res = await request(app).get("/bookmarks?cursor=abc").set(u.auth);
    expect(res.status).toBe(400);
  });
});