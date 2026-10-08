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

export const driverDispatches = sqliteTable("driver_dispatches", {
  deviceId: text("device_id").primaryKey().references(() => trackingDevices.id),
  ownerId: text("owner_id").notNull(),
  dispatchJson: text("dispatch_json").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, t => [index("driver_dispatches_owner").on(t.ownerId)]);

export const officeOrders = sqliteTable("office_orders", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(),
  deviceId: text("device_id"), dispatchId: text("dispatch_id"),
  status: text("status").notNull(), inputJson: text("input_json").notNull(),
  payloadJson: text("payload_json").notNull(), version: integer("version").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, t => [index("office_orders_owner_status").on(t.ownerId,t.status,t.updatedAt), uniqueIndex("office_orders_dispatch").on(t.dispatchId)]);
export const officePartners = sqliteTable("office_partners", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(),
  payloadJson: text("payload_json").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [index("office_partners_owner").on(t.ownerId,t.updatedAt)]);
export const officeDriverProfiles = sqliteTable("office_driver_profiles", {
  deviceId: text("device_id").primaryKey().references(() => trackingDevices.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(), profileJson: text("profile_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, t => [index("office_profiles_owner").on(t.ownerId)]);
export const officeSettings = sqliteTable("office_settings", {
  ownerId: text("owner_id").primaryKey(), payloadJson: text("payload_json").notNull(), updatedAt: integer("updated_at").notNull(),
});
export const placeSearchCache = sqliteTable("place_search_cache", {
  ownerId: text("owner_id").notNull(), cacheKey: text("cache_key").notNull(),
  payloadJson: text("payload_json").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.ownerId,t.cacheKey] })]);
export const placeSearchGate = sqliteTable("place_search_gate", {
  provider: text("provider").primaryKey(), nextAllowedAt: integer("next_allowed_at").notNull(),
});
export const driverRuntime = sqliteTable("driver_runtime", {
  deviceId:text("device_id").primaryKey().references(()=>trackingDevices.id,{onDelete:"cascade"}),ownerId:text("owner_id").notNull(),
  appVersion:integer("app_version").notNull().default(1),onDuty:integer("on_duty").notNull().default(0),gpsEnabled:integer("gps_enabled").notNull().default(0),heartbeatAt:integer("heartbeat_at").notNull(),
},t=>[index("driver_runtime_owner").on(t.ownerId)]);
export const orderOffers = sqliteTable("order_offers", {
  orderId:text("order_id").primaryKey().references(()=>officeOrders.id),ownerId:text("owner_id").notNull(),expiresAt:integer("expires_at").notNull(),eligibleJson:text("eligible_json").notNull(),
},t=>[index("order_offers_owner_deadline").on(t.ownerId,t.expiresAt)]);
export const driverReceipts = sqliteTable("driver_receipts", {
  deviceId:text("device_id").notNull(),operationId:text("operation_id").notNull(),ownerId:text("owner_id").notNull(),requestJson:text("request_json").notNull(),responseJson:text("response_json").notNull(),createdAt:integer("created_at").notNull(),
},t=>[primaryKey({columns:[t.deviceId,t.operationId]}),index("driver_receipts_owner").on(t.ownerId,t.createdAt)]);
export const officePayments = sqliteTable("office_payments", {
  orderId:text("order_id").primaryKey().references(()=>officeOrders.id),ownerId:text("owner_id").notNull(),deviceId:text("device_id").notNull(),status:text("status").notNull(),amountMinor:integer("amount_minor").notNull(),payloadJson:text("payload_json").notNull(),updatedAt:integer("updated_at").notNull(),version:integer("version").notNull(),
},t=>[index("office_payments_owner").on(t.ownerId,t.updatedAt)]);
