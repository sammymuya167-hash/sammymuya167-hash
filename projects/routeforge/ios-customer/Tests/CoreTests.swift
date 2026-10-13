import XCTest
import WebKit
@testable import RouteForgeShop

final class CoreTests: XCTestCase {
    func testCustomerNavigationCannotOpenAdminRiderOrAPI() {
        for path in ["/admin", "/merchant", "/tracking", "/login", "/api/customer/session", "/shopper", "/shop/../admin", "/shop/%2e%2e/admin", "/shop/%5cadmin"] {
            XCTAssertFalse(ShopOrigin.isShopPage(URL(string: "https://" + ShopOrigin.host + path)!))
        }
        for path in ["/shop", "/shop/privacy", "/shop/terms", "/shop/delete-account", "/shop?store=zenimart"] {
            XCTAssertTrue(ShopOrigin.isShopPage(URL(string: "https://" + ShopOrigin.host + path)!))
        }
    }
    func testSimilarHostCredentialsInURLAndInsecureTransportAreRejected() {
        for value in ["http://" + ShopOrigin.host + "/shop", "https://" + ShopOrigin.host + ".evil.test/shop",
                      "https://evil.test@" + ShopOrigin.host + "/shop", "https://" + ShopOrigin.host + ":8443/shop",
                      "file:///shop", "javascript:alert(1)", "data:text/html,shop"] {
            XCTAssertFalse(ShopOrigin.isShopPage(URL(string: value)!))
        }
    }
    func testAPIRequestsCannotLeaveOriginalCustomerBackend() {
        XCTAssertTrue(ShopOrigin.isAPI(ShopOrigin.base.appendingPathComponent("api/customer/orders")))
        XCTAssertFalse(ShopOrigin.isAPI(ShopOrigin.base.appendingPathComponent("api/office/orders")))
        XCTAssertFalse(ShopOrigin.isAPI(URL(string: "https://evil.test/api/customer/orders")!))
    }
    func testOnlySecureExactHostHttpOnlyCustomerCookieIsUsed() {
        func cookie(_ changes: [HTTPCookiePropertyKey: Any] = [:]) -> HTTPCookie {
            let base: [HTTPCookiePropertyKey: Any] = [.name: ShopOrigin.cookieName, .value: "test-token", .domain: ShopOrigin.host, .path: "/", .secure: "TRUE", HTTPCookiePropertyKey("HttpOnly"): "TRUE", .expires: Date(timeIntervalSinceNow: 3600)]
            return HTTPCookie(properties: base.merging(changes, uniquingKeysWith: { _, b in b }))!
        }
        XCTAssertNotNil(ShopOrigin.sessionCookie(in: [cookie()]))
        for c in [cookie([.domain: ".chatgpt.site"]), cookie([.name: "office_session"]), cookie([.path: "/shop"]), cookie([.expires: Date(timeIntervalSinceNow: -1)]), cookie([HTTPCookiePropertyKey("HttpOnly"): "FALSE"])] {
            XCTAssertNil(ShopOrigin.sessionCookie(in: [c]))
        }
    }
    func testAccountSwitchDoesNotGenerateAnotherPersonsOrderNotifications() {
        var changes = OrderChanges()
        let original = order(status: "placed"), moved = order(status: "on_delivery")
        XCTAssertTrue(changes.updates(customerID: "a", orders: [original]).isEmpty)
        XCTAssertEqual(changes.updates(customerID: "a", orders: [moved]).map(\.id), [original.id])
        XCTAssertTrue(changes.updates(customerID: "a", orders: [moved]).isEmpty)
        XCTAssertTrue(changes.updates(customerID: "b", orders: [original]).isEmpty)
        changes.clear()
        XCTAssertTrue(changes.updates(customerID: "b", orders: [moved]).isEmpty)
    }
    func testHistoricalAndNewOrdersDoNotProduceFalseStatusAlerts() {
        var changes = OrderChanges()
        let historical = order(status: "completed")
        XCTAssertTrue(changes.updates(customerID: "a", orders: [historical]).isEmpty)
        XCTAssertTrue(changes.updates(customerID: "a", orders: [historical, order(id: "new", status: "placed")]).isEmpty)
    }
    func testStaleInvalidAndFutureRiderPinsAreHidden() {
        let now = Date(timeIntervalSince1970: 1000)
        XCTAssertNotNil(RiderPin(lat: -1.28, lng: 36.81, at: 999_000).coordinate(now: now))
        for pin in [RiderPin(lat: -1.28, lng: 36.81, at: 900_000), RiderPin(lat: 91, lng: 36, at: 999_000), RiderPin(lat: -1, lng: 181, at: 999_000), RiderPin(lat: -1, lng: 36, at: 1_010_000)] {
            XCTAssertNil(pin.coordinate(now: now))
        }
    }
    func testCourierHandoffIsDistinctFromDeliveredAndMoneyKeepsCents() {
        XCTAssertEqual(order(status: "with_courier").statusTitle, "Handed to courier")
        XCTAssertEqual(order(status: "completed").statusTitle, "Completed")
        XCTAssertEqual(order(status: "placed").money, "KES 123.45")
        XCTAssertEqual(order(status: "future_status").statusTitle, "Order update")
    }
    @MainActor func testNativePermissionsAndWebIsolation() {
        let client = CustomerClient()
        let controller = ShopWebController(client: client)
        XCTAssertTrue(controller.webView.configuration.limitsNavigationsToAppBoundDomains)
        XCTAssertFalse(controller.webView.configuration.preferences.javaScriptCanOpenWindowsAutomatically)
        XCTAssertTrue(controller.webView.configuration.defaultWebpagePreferences.allowsContentJavaScript)
        let info = Bundle.main.infoDictionary ?? [:]
        XCTAssertNil(info["NSLocationAlwaysAndWhenInUseUsageDescription"])
        XCTAssertNil(info["NSCameraUsageDescription"])
        XCTAssertNil(info["NSMicrophoneUsageDescription"])
        XCTAssertNil(info["UIBackgroundModes"])
        XCTAssertEqual(info["WKAppBoundDomains"] as? [String], [ShopOrigin.host])
    }
    private func order(id: String = "sample", status: String) -> ShopOrder {
        ShopOrder(id: id, reference: "RF-TEST", storeName: "Unit test shop", status: status,
                  totalMinor: 12345, createdAt: 1_000_000, deliveryOtp: nil, rider: nil, riderLocation: nil)
    }
}
