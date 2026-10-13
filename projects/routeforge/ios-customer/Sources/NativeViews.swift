import SwiftUI
import MapKit

struct NativeOrders: View {
    @ObservedObject var client: CustomerClient
    let openShop: () -> Void
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Group {
                if client.customer == nil {
                    ContentUnavailableView {
                        Label("Sign in to see your orders", systemImage: "person.crop.circle")
                    } description: { Text("Use your existing RouteForge customer account in the shop.") }
                    actions: { Button("Open shop", action: openShop).buttonStyle(.borderedProminent) }
                } else if client.orders.isEmpty {
                    ContentUnavailableView("Your orders will appear here", systemImage: "shippingbox", description: Text("Place an order in Zenimart Enterprise to follow its progress."))
                } else {
                    List {
                        if let error = client.error { Text(error).foregroundStyle(.secondary) }
                        ForEach(client.orders) { order in
                            NavigationLink { NativeOrderDetail(orderID: order.id, client: client) } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack { Text(order.reference).font(.headline); Spacer(); Text(order.money).font(.subheadline) }
                                    Text(order.storeName).font(.subheadline)
                                    Label(order.statusTitle, systemImage: order.status == "completed" ? "checkmark.circle.fill" : "truck.box")
                                        .font(.subheadline).foregroundStyle(order.status == "cancelled" ? .red : .green)
                                    Text(order.date, format: .dateTime.day().month().hour().minute()).font(.caption).foregroundStyle(.secondary)
                                }.padding(.vertical, 5)
                            }
                        }
                    }.refreshable { await client.refresh() }
                }
            }
            .navigationTitle("My orders")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .overlay(alignment: .bottom) {
                if client.refreshing { ProgressView("Refreshing orders…").padding().background(.regularMaterial, in: Capsule()) }
            }
            .task { await client.refresh() }
        }
    }
}

struct NativeOrderDetail: View {
    let orderID: String
    @ObservedObject var client: CustomerClient
    private var order: ShopOrder? { client.orders.first { $0.id == orderID } }
    var body: some View {
        if let order {
        List {
            Section("Delivery progress") {
                Label(order.statusTitle, systemImage: "truck.box.fill").font(.headline)
                LabeledContent("Shop", value: order.storeName)
                LabeledContent("Order total", value: order.money)
                if let rider = order.rider { LabeledContent("Rider", value: rider) }
                Text("Confirm delivery quotes and manage your order from the shop's Orders tab.").font(.footnote).foregroundStyle(.secondary)
            }
            if let pin = order.riderLocation, let location = pin.coordinate() {
                Section("Rider location") {
                    Map(initialPosition: .region(MKCoordinateRegion(center: location, span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)))) {
                        Marker("Your rider", systemImage: "bicycle", coordinate: location).tint(.green)
                    }.id(pin.at).frame(height: 230).clipShape(RoundedRectangle(cornerRadius: 14))
                    Text("Latest confirmed rider location. Open the shop's order view for delivery updates.").font(.caption).foregroundStyle(.secondary)
                }
            }
            if let otp = order.deliveryOtp {
                Section("Delivery confirmation") {
                    Text(otp).font(.system(.title, design: .monospaced)).textSelection(.enabled)
                    Text("Give this code to the rider only after you receive your order.").font(.footnote)
                }
            }
        }.navigationTitle(order.reference).navigationBarTitleDisplayMode(.inline)
        } else {
            ContentUnavailableView("Order unavailable", systemImage: "lock", description: Text("Sign in to your customer account to view this order."))
        }
    }
}

struct NativeSettings: View {
    @ObservedObject var client: CustomerClient
    let openPage: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                Section("Order updates") {
                    Button("Enable order alerts") { Task { await client.enableAlerts() } }.accessibilityIdentifier("enableNativeAlerts")
                    Button("Turn order alerts off") { client.disableAlerts() }
                    if let message = client.alertMessage { Text(message).font(.footnote).accessibilityIdentifier("nativeAlertStatus") }
                    Text("Your orders refresh while the app is open. Notifications after closing the app are not enabled in this build.").font(.footnote).foregroundStyle(.secondary)
                }
                Section("Your account and data") {
                    Button("Privacy & data") { openPage("/shop/privacy") }
                    Button("Ordering & delivery terms") { openPage("/shop/terms") }
                    Button("Delete my account") { openPage("/shop/delete-account") }
                    Text("Location is optional and is used when you choose a delivery pin. This customer app does not record your journeys.").font(.footnote).foregroundStyle(.secondary)
                }
                Section("RouteForge by SHADOWNET") {
                    LabeledContent("Customer iOS version", value: ShopOrigin.versionLabel)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Customer iOS version")
                        .accessibilityValue(ShopOrigin.versionLabel)
                        .accessibilityIdentifier("installedVersion")
                    Link("Contact support", destination: URL(string: "mailto:sammymuya167@gmail.com")!)
                }
            }.navigationTitle("App settings")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
