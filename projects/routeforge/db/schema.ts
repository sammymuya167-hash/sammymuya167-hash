import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    scenarioJson: text("scenario_json").notNull(),
    resultJson: text("result_json").notNull(),
    updatedAt: integer("updated_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => [index("plans_owner_updated").on(table.ownerId, table.updatedAt)],
);
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    scenarioJson: text("scenario_json").notNull(),
    resultJson: text("result_json").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("runs_owner_created").on(table.ownerId, table.createdAt)],
);
