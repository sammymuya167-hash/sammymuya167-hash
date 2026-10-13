import SwiftUI

@main struct RouteForgeShopApp: App {
    @StateObject private var client = CustomerClient()
    var body: some Scene { WindowGroup { CustomerRoot(client: client) } }
}

struct CustomerRoot: View {
    @ObservedObject var client: CustomerClient
    @Environment(\.scenePhase) private var phase
    @State private var controller: ShopWebController?
    @State private var showOrders = false
    @State private var showSettings = false
    private let green = Color(red: 0.118, green: 0.208, blue: 0.161)
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "bag.fill").foregroundStyle(.orange)
                Text("RouteForge Shop").font(.headline)
                Spacer()
                Button { showOrders = true } label: { Label("My orders", systemImage: "shippingbox") }
                    .labelStyle(.iconOnly).accessibilityIdentifier("nativeOrders")
                Button { showSettings = true } label: { Label("App settings", systemImage: "gearshape") }
                    .labelStyle(.iconOnly).accessibilityIdentifier("nativeSettings")
            }.padding().foregroundStyle(.white).background(green)
            if let controller { ShopWebView(controller: controller) } else { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
        }
        .overlay {
            if phase == .background {
                VStack(spacing: 12) { Image(systemName: "bag.fill").font(.largeTitle); Text("RouteForge Shop").font(.headline) }
                    .frame(maxWidth: .infinity, maxHeight: .infinity).foregroundStyle(.white).background(green)
            }
        }
        .task {
            if controller == nil { controller = ShopWebController(client: client) }
            client.setActive(true)
            while !Task.isCancelled {
                await client.refresh()
                do { try await Task.sleep(for: .seconds(15)) } catch { break }
            }
        }
        .onChange(of: phase) { _, value in
            client.setActive(value == .active)
            if value == .active { Task { await client.refresh() } }
        }
        .sheet(isPresented: $showOrders) {
            NativeOrders(client: client) { showOrders = false; controller?.loadShop() }
                .presentationDetents([.large])
        }
        .sheet(isPresented: $showSettings, onDismiss: { client.alertMessage = nil }) {
            NativeSettings(client: client) { path in showSettings = false; controller?.loadShop(path: path) }
                .presentationDetents([.large])
        }
        .alert("Order alerts", isPresented: Binding(get: { client.alertMessage != nil && !showSettings }, set: { if !$0 { client.alertMessage = nil } })) {
            Button("OK") { client.alertMessage = nil }
        } message: { Text(client.alertMessage ?? "") }
    }
}
