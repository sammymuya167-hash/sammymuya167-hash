import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
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

export const companyAccounts=sqliteTable("company_accounts",{
  id:text("id").primaryKey(),ownerId:text("owner_id").notNull(),username:text("username").notNull(),usernameKey:text("username_key").notNull().unique(),passwordHash:text("password_hash").notNull(),role:text("role",{enum:["office","rider"]}).notNull(),deviceId:text("device_id").unique(),phone:text("phone").notNull().default(""),enabled:integer("enabled").notNull().default(1),version:integer("version").notNull().default(1),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull(),
},t=>[index("company_accounts_owner").on(t.ownerId,t.role)]);
export const officeSessions=sqliteTable("office_sessions",{
  tokenHash:text("token_hash").primaryKey(),accountId:text("account_id").notNull().references(()=>companyAccounts.id,{onDelete:"cascade"}),accountVersion:integer("account_version").notNull(),expiresAt:integer("expires_at").notNull(),
},t=>[index("office_sessions_expiry").on(t.expiresAt)]);
export const riderLogins=sqliteTable("rider_logins",{
  deviceId:text("device_id").primaryKey().references(()=>trackingDevices.id,{onDelete:"cascade"}),accountId:text("account_id").notNull().references(()=>companyAccounts.id,{onDelete:"cascade"}),accountVersion:integer("account_version").notNull(),tokenHash:text("token_hash").notNull(),
});
export const loginLimits=sqliteTable("login_limits",{key:text("key").primaryKey(),startedAt:integer("started_at").notNull(),attempts:integer("attempts").notNull()});

// Additive network records. Existing office owners, orders and phone IDs remain authoritative.
export const merchants=sqliteTable("merchants",{
  id:text("id").primaryKey(),name:text("name").notNull(),email:text("email").notNull(),phone:text("phone").notNull(),
  status:text("status").notNull().default("pending"),fleetMode:text("fleet_mode").notNull().default("owned"),
  fallbackEnabled:integer("fallback_enabled").notNull().default(0),acceptedPricingVersion:integer("accepted_pricing_version"),
  subscription:text("subscription").notNull().default("standard"),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull(),
});
export const merchantStaff=sqliteTable("merchant_staff",{
  accountId:text("account_id").primaryKey().references(()=>companyAccounts.id),merchantId:text("merchant_id").notNull().references(()=>merchants.id),
  role:text("role").notNull(),
},t=>[index("merchant_staff_tenant").on(t.merchantId)]);
export const merchantBranches=sqliteTable("merchant_branches",{
  id:text("id").primaryKey(),merchantId:text("merchant_id").notNull().references(()=>merchants.id),
  name:text("name").notNull(),locationJson:text("location_json").notNull(),active:integer("active").notNull().default(1),createdAt:integer("created_at").notNull(),
},t=>[index("merchant_branches_tenant").on(t.merchantId)]);
export const serviceAreas=sqliteTable("service_areas",{
  id:text("id").primaryKey(),name:text("name").notNull(),configJson:text("config_json").notNull(),active:integer("active").notNull().default(1),version:integer("version").notNull().default(1),
});
export const merchantPricingAcceptances=sqliteTable("merchant_pricing_acceptance",{
  merchantId:text("merchant_id").notNull().references(()=>merchants.id),areaId:text("area_id").notNull().references(()=>serviceAreas.id),
  version:integer("version").notNull(),termsJson:text("terms_json").notNull(),acceptedBy:text("accepted_by").notNull(),acceptedAt:integer("accepted_at").notNull(),
},t=>[primaryKey({columns:[t.merchantId,t.areaId]})]);
export const networkRiders=sqliteTable("network_riders",{
  deviceId:text("device_id").primaryKey().references(()=>trackingDevices.id),ownerId:text("owner_id").notNull(),merchantId:text("merchant_id").references(()=>merchants.id),
  vehicleType:text("vehicle_type").notNull(),capacityGrams:integer("capacity_grams").notNull(),areaId:text("area_id").notNull().references(()=>serviceAreas.id),enabled:integer("enabled").notNull().default(1),
},t=>[index("network_riders_tenant").on(t.merchantId,t.areaId)]);
export const merchantIntegrations=sqliteTable("merchant_integrations",{
  id:text("id").primaryKey(),merchantId:text("merchant_id").notNull().references(()=>merchants.id),name:text("name").notNull(),
  keyHash:text("key_hash").notNull().unique(),keyPrefix:text("key_prefix").notNull(),secretCipher:text("secret_cipher").notNull(),
  webhookUrl:text("webhook_url"),enabled:integer("enabled").notNull().default(1),createdAt:integer("created_at").notNull(),
},t=>[index("integrations_tenant").on(t.merchantId)]);
export const merchantDeliveries=sqliteTable("merchant_deliveries",{
  orderId:text("order_id").primaryKey().references(()=>officeOrders.id),merchantId:text("merchant_id").notNull().references(()=>merchants.id),externalId:text("external_id").notNull(),
  branchId:text("branch_id").notNull().references(()=>merchantBranches.id),inputJson:text("input_json").notNull(),
  ready:integer("ready").notNull().default(0),feeMinor:integer("fee_minor").notNull(),areaId:text("area_id").notNull().references(()=>serviceAreas.id),pricingVersion:integer("pricing_version").notNull(),
  commissionBps:integer("commission_bps").notNull().default(0),
  riderOwner:text("rider_owner"),fleet:text("fleet"),trackingHash:text("tracking_hash").notNull().unique(),otpHash:text("otp_hash").notNull(),proofJson:text("proof_json"),
  dispatchLeaseUntil:integer("dispatch_lease_until").notNull().default(0),nextAttemptAt:integer("next_attempt_at").notNull().default(0),attempts:integer("attempts").notNull().default(0),exception:text("exception"),
},t=>[uniqueIndex("delivery_external_tenant").on(t.merchantId,t.externalId),index("delivery_retry").on(t.ready,t.nextAttemptAt),index("network_delivery_rider").on(t.riderOwner,t.orderId)]);
export const networkOffers=sqliteTable("network_offers",{
  id:text("id").primaryKey(),orderId:text("order_id").notNull().references(()=>officeOrders.id),deviceId:text("device_id").notNull().references(()=>trackingDevices.id),
  status:text("status").notNull(),fleet:text("fleet").notNull(),expiresAt:integer("expires_at").notNull(),createdAt:integer("created_at").notNull(),
},t=>[index("network_offer_order").on(t.orderId,t.status),uniqueIndex("network_one_pending_offer").on(t.orderId).where(sql`status = 'pending'`),index("network_offer_device").on(t.deviceId,t.status,t.expiresAt)]);
export const networkEvents=sqliteTable("network_events",{
  id:text("id").primaryKey(),merchantId:text("merchant_id").notNull(),orderId:text("order_id"),eventType:text("event_type").notNull(),payloadJson:text("payload_json").notNull(),createdAt:integer("created_at").notNull(),
},t=>[index("network_event_tenant").on(t.merchantId,t.createdAt),index("network_events_order").on(t.orderId)]);
export const webhookOutbox=sqliteTable("webhook_outbox",{
  id:text("id").primaryKey(),integrationId:text("integration_id").notNull().references(()=>merchantIntegrations.id),eventId:text("event_id").notNull().references(()=>networkEvents.id),
  status:text("status").notNull().default("pending"),attempts:integer("attempts").notNull().default(0),nextAttemptAt:integer("next_attempt_at").notNull(),leaseUntil:integer("lease_until").notNull().default(0),lastStatus:integer("last_status"),
},t=>[uniqueIndex("webhook_event_once").on(t.integrationId,t.eventId),index("webhook_retry").on(t.status,t.nextAttemptAt)]);
export const networkAudit=sqliteTable("network_audit",{
  id:text("id").primaryKey(),merchantId:text("merchant_id").notNull(),actor:text("actor").notNull(),action:text("action").notNull(),subjectId:text("subject_id").notNull(),createdAt:integer("created_at").notNull(),
},t=>[index("network_audit_tenant").on(t.merchantId,t.createdAt)]);
export const networkLedger=sqliteTable("network_ledger",{
  orderId:text("order_id").primaryKey().references(()=>merchantDeliveries.orderId),merchantId:text("merchant_id").notNull(),deviceId:text("device_id").notNull(),
  feeMinor:integer("fee_minor").notNull(),commissionMinor:integer("commission_minor").notNull(),riderEarningMinor:integer("rider_earning_minor"),
  state:text("state").notNull().default("pending_review"),createdAt:integer("created_at").notNull(),
},t=>[index("network_ledger_tenant").on(t.merchantId,t.createdAt),index("network_ledger_rider").on(t.deviceId)]);

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
