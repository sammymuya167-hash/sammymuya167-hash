import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable("workspaces", {
  ownerId: text("owner_id").primaryKey(),
  boardJson: text("board_json").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
