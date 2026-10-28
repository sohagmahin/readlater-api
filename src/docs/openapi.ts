import { z, type ZodType } from "zod";
import { bookmarkStatus, fetchStatus } from "../db/schema.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
} from "../modules/auth/auth.schemas.js";
import {
  createBookmarkSchema,
  listQuerySchema,
  updateBookmarkSchema,
} from "../modules/bookmarks/bookmarks.schemas.js";
import { addTagsSchema } from "../modules/tags/tags.schemas.js";

// রিকোয়েস্টের অংশ zod স্কিমা থেকেই বানাই, যাতে ভ্যালিডেশন বদলালে ডকসও বদলায়
type ObjectSchema = {
  properties?: Record<string, unknown>;
  required?: string[];
};

const jsonSchema = (schema: ZodType) =>
  z.toJSONSchema(schema, { io: "input", target: "openapi-3.0" });

const body = (schema: ZodType) => ({
  required: true,
  content: { "application/json": { schema: jsonSchema(schema) } },
});

function queryParams(schema: ZodType) {
  const { properties = {}, required = [] } = jsonSchema(schema) as ObjectSchema;
  return Object.entries(properties).map(([name, s]) => ({
    name,
    in: "query",
    required: required.includes(name),
    schema: s,
  }));
}

const pathParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const ok = (description: string, schema: object) => ({
  description,
  content: { "application/json": { schema } },
});

const err = (description: string) => ok(description, ref("Error"));

const authed = {
  security: [{ bearerAuth: [] }],
  responses: {
    401: err("Missing, invalid or expired access token"),
    429: err("Rate limit hit (100 requests/min per user)"),
  },
};

export const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "ReadLater API",
    version: "1.0.0",
    description: [
      "Save links to read later, tag them, and page through them.",
      "",
      "**Try it:** call `POST /auth/login`, copy `accessToken`, and paste it into **Bearer Token** under Authentication.",
      "",
      "Rate limits: `/auth/*` 10 requests/min per IP, everything else 100 requests/min per user.",
    ].join("\n"),
  },
  tags: [
    { name: "Auth" },
    { name: "Bookmarks" },
    { name: "Tags" },
    { name: "System" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { description: "Validation issues, when present" },
        },
        required: ["error"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Tokens: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      Tag: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
        },
      },
      TagWithCount: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          bookmarkCount: { type: "integer" },
        },
      },
      Bookmark: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          url: { type: "string", format: "uri" },
          title: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          faviconUrl: { type: "string", nullable: true },
          status: { type: "string", enum: bookmarkStatus.enumValues },
          fetchStatus: {
            type: "string",
            enum: fetchStatus.enumValues,
            description: "Background title/description/favicon fetch",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          tags: {
            type: "array",
            items: ref("Tag"),
            description: "Not included in the POST /bookmarks response",
          },
        },
      },
      BookmarkPage: {
        type: "object",
        properties: {
          items: { type: "array", items: ref("Bookmark") },
          nextCursor: {
            type: "string",
            nullable: true,
            description: "Pass as `cursor` to get the next page; null on the last page",
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: ok("Server is up", {
            type: "object",
            properties: { status: { type: "string", example: "ok" } },
          }),
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        requestBody: body(registerSchema),
        responses: {
          201: ok("Account created", ref("User")),
          400: err("Validation failed"),
          409: err("Email already registered"),
          429: err("Rate limit hit"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and get tokens",
        requestBody: body(loginSchema),
        responses: {
          200: ok("Access and refresh tokens", ref("Tokens")),
          400: err("Validation failed"),
          401: err("Invalid email or password"),
          429: err("Rate limit hit"),
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Get a new access token",
        requestBody: body(refreshSchema),
        responses: {
          200: ok("New access token", {
            type: "object",
            properties: { accessToken: { type: "string" } },
          }),
          400: err("Validation failed"),
          401: err("Invalid or expired refresh token"),
          429: err("Rate limit hit"),
        },
      },
    },
    "/bookmarks": {
      get: {
        tags: ["Bookmarks"],
        summary: "List bookmarks, newest first",
        security: authed.security,
        parameters: queryParams(listQuerySchema),
        responses: {
          200: ok("One page of bookmarks", ref("BookmarkPage")),
          400: err("Invalid query or cursor"),
          ...authed.responses,
        },
      },
      post: {
        tags: ["Bookmarks"],
        summary: "Save a URL",
        description:
          "Title, description and favicon are fetched in the background; poll the bookmark until `fetchStatus` is `ready`.",
        security: authed.security,
        requestBody: body(createBookmarkSchema),
        responses: {
          201: ok("Bookmark created", ref("Bookmark")),
          200: ok("URL was already saved; existing bookmark returned", ref("Bookmark")),
          400: err("Validation failed"),
          ...authed.responses,
        },
      },
    },
    "/bookmarks/{id}": {
      parameters: [pathParam("id")],
      get: {
        tags: ["Bookmarks"],
        summary: "Get one bookmark",
        security: authed.security,
        responses: {
          200: ok("The bookmark", ref("Bookmark")),
          400: err("Invalid id"),
          404: err("Bookmark not found"),
          ...authed.responses,
        },
      },
      patch: {
        tags: ["Bookmarks"],
        summary: "Update status or title",
        security: authed.security,
        requestBody: body(updateBookmarkSchema),
        responses: {
          200: ok("Updated bookmark", ref("Bookmark")),
          400: err("Validation failed"),
          404: err("Bookmark not found"),
          ...authed.responses,
        },
      },
      delete: {
        tags: ["Bookmarks"],
        summary: "Delete a bookmark",
        security: authed.security,
        responses: {
          204: { description: "Deleted" },
          400: err("Invalid id"),
          404: err("Bookmark not found"),
          ...authed.responses,
        },
      },
    },
    "/bookmarks/{id}/tags": {
      parameters: [pathParam("id")],
      post: {
        tags: ["Tags"],
        summary: "Add tags to a bookmark",
        description: "Names are trimmed, lowercased and de-duplicated. Missing tags are created.",
        security: authed.security,
        requestBody: body(addTagsSchema),
        responses: {
          200: ok("The tags now attached", { type: "array", items: ref("Tag") }),
          400: err("Validation failed"),
          404: err("Bookmark not found"),
          ...authed.responses,
        },
      },
    },
    "/bookmarks/{id}/tags/{tagId}": {
      parameters: [pathParam("id"), pathParam("tagId")],
      delete: {
        tags: ["Tags"],
        summary: "Remove a tag from a bookmark",
        security: authed.security,
        responses: {
          204: { description: "Removed" },
          400: err("Invalid id"),
          404: err("Bookmark not found, or tag not attached"),
          ...authed.responses,
        },
      },
    },
    "/tags": {
      get: {
        tags: ["Tags"],
        summary: "List your tags with bookmark counts",
        security: authed.security,
        responses: {
          200: ok("All tags, sorted by name", {
            type: "array",
            items: ref("TagWithCount"),
          }),
          ...authed.responses,
        },
      },
    },
  },
};
