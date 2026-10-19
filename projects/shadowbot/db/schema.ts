import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);
export const bots = sqliteTable(
  "bots",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    greeting: text("greeting").notNull(),
    color: text("color").notNull(),
    isPublic: integer("is_public").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("bots_owner").on(t.ownerId),
    index("bots_public").on(t.isPublic),
  ],
);
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    digest: text("digest").notNull(),
    bytes: integer("bytes").notNull(),
    chunkCount: integer("chunk_count").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("documents_bot").on(t.botId),
    uniqueIndex("documents_dedupe").on(t.botId, t.digest),
  ],
);
export const chunks = sqliteTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("chunks_bot").on(t.botId)],
);
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    botId: text("bot_id").notNull(),
    title: text("title").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    leaseUntil: integer("lease_until").notNull().default(0),
  },
  (t) => [index("conversations_user_time").on(t.userId, t.updatedAt)],
);
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    sources: text("sources").notNull().default("[]"),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("messages_conversation_time").on(t.conversationId, t.createdAt),
  ],
);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
