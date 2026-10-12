import Foundation
import WebKit
import UserNotifications
import Combine

final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

enum CustomerError: LocalizedError {
    case connection, session, invalidResponse
    var errorDescription: String? {
        switch self {
        case .connection: return "Connection interrupted. Pull down to try again."
        case .session: return "Sign in to the shop to see your orders."
        case .invalidResponse: return "Could not refresh orders. Please try again."
        }
    }
}

@MainActor final class CustomerClient: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published private(set) var customer: ShopCustomer?
    @Published private(set) var orders: [ShopOrder] = []
    @Published private(set) var refreshing = false
    @Published var error: String?
    @Published var alertMessage: String?
    private var changes = OrderChanges()
    private var epoch = 0
    private var active = false
    private let cookies: WKHTTPCookieStore
    private let session: URLSession
    private let notifications = UNUserNotificationCenter.current()
    private var alertsEnabled: Bool { UserDefaults.standard.bool(forKey: "orderAlertsEnabled") }

    init(dataStore: WKWebsiteDataStore = .default()) {
        cookies = dataStore.httpCookieStore
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 30
        session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
        super.init()
        notifications.delegate = self
    }

    func setActive(_ value: Bool) { active = value; if !value { epoch += 1 } }
    func sessionChanged() {
        epoch += 1
        customer = nil; orders = []; changes.clear(); error = nil
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
    }

    private func currentCookie() async -> HTTPCookie? {
        let all = await withCheckedContinuation { continuation in
            cookies.getAllCookies { continuation.resume(returning: $0) }
        }
        return ShopOrigin.sessionCookie(in: all)
    }

    private func request<T: Decodable>(_ path: String, cookie: HTTPCookie) async throws -> T {
        let url = ShopOrigin.base.appendingPathComponent("api/customer/" + path)
        guard ShopOrigin.isAPI(url) else { throw CustomerError.invalidResponse }
        var request = URLRequest(url: url)
        request.setValue(HTTPCookie.requestHeaderFields(with: [cookie])["Cookie"], forHTTPHeaderField: "Cookie")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.url.map(ShopOrigin.isAPI) == true else { throw CustomerError.invalidResponse }
        if http.statusCode == 401 { throw CustomerError.session }
        guard http.statusCode == 200, data.count <= 2_000_000 else { throw CustomerError.invalidResponse }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func refresh() async {
        guard active, !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        let version = epoch
        guard let cookie = await currentCookie() else { sessionChanged(); return }
        do {
            let identity: SessionResponse = try await request("session", cookie: cookie)
            guard let person = identity.customer else { throw CustomerError.session }
            let result: OrdersResponse = try await request("orders", cookie: cookie)
            let latestCookie = await currentCookie()
            guard active, epoch == version, latestCookie?.value == cookie.value else { return }
            let updates = changes.updates(customerID: person.id, orders: result.orders)
            customer = person; orders = result.orders; error = nil
            if alertsEnabled {
                for order in updates.prefix(3) {
                    let content = UNMutableNotificationContent()
                    content.title = "RouteForge order update"
                    content.body = order.reference + " · " + order.statusTitle
                    content.sound = .default
                    // No phone, address, OTP, customer name or rider location on the lock screen.
                    try? await notifications.add(UNNotificationRequest(identifier: order.id, content: content, trigger: nil))
                }
            }
        } catch {
            guard epoch == version, active else { return }
            if let customerError = error as? CustomerError, case .session = customerError { sessionChanged() }
            else { self.error = CustomerError.connection.localizedDescription }
        }
    }

    func enableAlerts() async {
        do {
            let allowed = try await notifications.requestAuthorization(options: [.alert, .sound, .badge])
            UserDefaults.standard.set(allowed, forKey: "orderAlertsEnabled")
            alertMessage = allowed ? "Order alerts are enabled while RouteForge is open. Updates also appear in My orders."
                : "Notifications are blocked. You can allow them in iPhone Settings. Your orders still refresh in the app."
        } catch { alertMessage = "Could not enable notifications. Your orders still refresh in the app." }
    }

    func disableAlerts() {
        UserDefaults.standard.set(false, forKey: "orderAlertsEnabled")
        notifications.removeAllPendingNotificationRequests()
        notifications.removeAllDeliveredNotifications()
        alertMessage = "Order alerts are off."
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}
