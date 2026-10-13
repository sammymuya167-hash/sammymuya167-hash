import XCTest
import WebKit
@testable import RouteForgeShop

private final class CustomerProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, String))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            guard let handler = Self.handler else { throw URLError(.notConnectedToInternet) }
            let (status, body) = try handler(request)
            client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

final class ClientTests: XCTestCase {
    private let identity = #"{"customer":{"id":"first-customer","name":"Unit test"}}"#
    private let orders = #"{"orders":[{"id":"one","reference":"RF-UNIT","storeName":"Unit shop","status":"placed","totalMinor":12345,"createdAt":1000000}]}"#
    override func tearDown() { CustomerProtocol.handler = nil; super.tearDown() }

    @MainActor private func makeClient() async -> CustomerClient {
        let store = WKWebsiteDataStore.nonPersistent()
        let response = HTTPURLResponse(url: ShopOrigin.base, statusCode: 200, httpVersion: nil,
            headerFields: ["Set-Cookie": ShopOrigin.cookieName + "=unit-token; Path=/; HttpOnly; Secure; Max-Age=3600"])!
        let cookie = HTTPCookie.cookies(withResponseHeaderFields: response.allHeaderFields as! [String: String], for: ShopOrigin.base).first!
        await withCheckedContinuation { continuation in store.httpCookieStore.setCookie(cookie) { continuation.resume() } }
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [CustomerProtocol.self]
        let client = CustomerClient(dataStore: store, configuration: config)
        client.setActive(true)
        return client
    }

    @MainActor func testOwnSessionLoadsOrdersAndLogoutClearsLoadedPrivateData() async {
        let client = await makeClient()
        CustomerProtocol.handler = { [identity, orders] request in
            XCTAssertTrue(ShopOrigin.isAPI(request.url!))
            XCTAssertEqual(request.value(forHTTPHeaderField: "Cookie"), ShopOrigin.cookieName + "=unit-token")
            return (200, request.url!.path.hasSuffix("/session") ? identity : orders)
        }
        await client.refresh()
        XCTAssertEqual(client.customer?.id, "first-customer")
        XCTAssertEqual(client.orders.map(\.reference), ["RF-UNIT"])
        client.sessionChanged()
        XCTAssertNil(client.customer); XCTAssertTrue(client.orders.isEmpty)
    }

    @MainActor func testRevokedServerSessionClearsPreviouslyLoadedOrders() async {
        let client = await makeClient()
        CustomerProtocol.handler = { [identity, orders] request in (200, request.url!.path.hasSuffix("/session") ? identity : orders) }
        await client.refresh(); XCTAssertEqual(client.orders.count, 1)
        CustomerProtocol.handler = { _ in (401, #"{"error":"Session expired"}"#) }
        await client.refresh()
        XCTAssertNil(client.customer); XCTAssertTrue(client.orders.isEmpty)
    }

    @MainActor func testOfflineFailureRecoversWithoutInventingOrders() async {
        let client = await makeClient()
        CustomerProtocol.handler = { _ in throw URLError(.notConnectedToInternet) }
        await client.refresh()
        XCTAssertNotNil(client.error); XCTAssertTrue(client.orders.isEmpty); XCTAssertFalse(client.refreshing)
        CustomerProtocol.handler = { [identity, orders] request in (200, request.url!.path.hasSuffix("/session") ? identity : orders) }
        await client.refresh()
        XCTAssertNil(client.error); XCTAssertEqual(client.orders.count, 1)
    }

    @MainActor func testBackgroundAppDoesNotKeepFetchingPrivateOrders() async {
        let client = await makeClient(); client.setActive(false)
        CustomerProtocol.handler = { _ in XCTFail("Background refresh was not authorized"); return (500, "{}") }
        await client.refresh()
        XCTAssertTrue(client.orders.isEmpty)
    }
}
