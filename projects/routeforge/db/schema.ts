import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
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

export const trackingDevices = sqliteTable(
  "tracking_devices",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    driverName: text("driver_name").notNull(),
    vehicleLabel: text("vehicle_label").notNull().default(""),
    phoneLabel: text("phone_label").notNull().default(""),
    deviceName: text("device_name"),
    createdAt: integer("created_at").notNull(),
    pairedAt: integer("paired_at"),
    pairCodeHash: text("pair_code_hash"),
    pairExpiresAt: integer("pair_expires_at"),
    tokenHash: text("token_hash"),
    revokedAt: integer("revoked_at"),
    lastSeenAt: integer("last_seen_at"),
    lastEventAt: integer("last_event_at"),
    lastEventKind: text("last_event_kind"),
    latestPointAt: integer("latest_point_at"),
    latestPointJson: text("latest_point_json"),
  },
  (t) => [
    index("tracking_devices_owner").on(t.ownerId),
    uniqueIndex("tracking_pair_code").on(t.pairCodeHash),
    uniqueIndex("tracking_token").on(t.tokenHash),
  ],
);
export const trackingEvents = sqliteTable(
  "tracking_events",
  {
    deviceId: text("device_id")
      .notNull()
      .references(() => trackingDevices.id),
    eventId: text("event_id").notNull(),
    tripId: text("trip_id").notNull(),
    kind: text("kind").notNull(),
    recordedAt: integer("recorded_at").notNull(),
    receivedAt: integer("received_at").notNull(),
    payloadJson: text("payload_json").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.deviceId, t.eventId] }),
    index("tracking_events_history").on(t.deviceId, t.recordedAt, t.eventId),
    index("tracking_events_trip").on(t.deviceId, t.tripId),
  ],
);
