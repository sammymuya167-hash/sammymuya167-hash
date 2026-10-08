import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable("boards", {
  ownerId: text("owner_id").primaryKey(),
  contentJson: text("content_json").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    contentJson: text("content_json").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("snapshots_owner_created").on(table.ownerId, table.createdAt)],
);
