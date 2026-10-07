import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable("workspaces", {
  ownerId: text("owner_id").primaryKey(),
  contentJson: text("content_json").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    collectionName: text("collection_name").notNull(),
    summaryJson: text("summary_json").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("runs_owner_created").on(t.ownerId, t.createdAt)],
);
