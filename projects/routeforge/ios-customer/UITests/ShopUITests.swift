import XCTest

final class ShopUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }
    func testInstalledCustomerAppLoadsRealZenimartShop() {
        let app = XCUIApplication(); app.launch()
        XCTAssertTrue(app.buttons["nativeOrders"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        XCTAssertTrue(app.webViews.staticTexts["Zenimart Enterprise"].firstMatch.waitForExistence(timeout: 120), "The installed app must reach the original live Zenimart catalog")
        let product = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Add ' AND label ENDSWITH ' to basket'")).firstMatch
        XCTAssertTrue(product.waitForExistence(timeout: 120), "The shop must load real purchasable products, beyond the heading")
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Live Zenimart shop on iPhone simulator"; screenshot.lifetime = .keepAlways
        add(screenshot)
    }
    func testNativeOrdersRequireCustomerSignIn() {
        let app = XCUIApplication(); app.launch()
        app.buttons["nativeOrders"].tap()
        XCTAssertTrue(app.staticTexts["Sign in to see your orders"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Open shop"].exists)
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["nativeOrders"].exists)
    }
    func testNativeSettingsExposeVersionPrivacyAndDeletion() {
        let app = XCUIApplication(); app.launch()
        app.buttons["nativeSettings"].tap()
        XCTAssertTrue(app.buttons["enableNativeAlerts"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Your orders refresh while the app is open. Notifications after closing the app are not enabled in this build."].exists)
        reveal(app.buttons["Privacy & data"], in: app)
        XCTAssertTrue(app.buttons["Privacy & data"].exists)
        reveal(app.buttons["Delete my account"], in: app)
        XCTAssertTrue(app.buttons["Delete my account"].exists)
        let version = app.descendants(matching: .any).matching(identifier: "installedVersion").firstMatch
        reveal(version, in: app)
        XCTAssertTrue(version.exists, app.debugDescription)
        XCTAssertEqual(version.value as? String, "1.0 (1)")
    }
    func testOfflineScreenAllowsRetryAndKeepsNativeNavigation() {
        let app = XCUIApplication(); app.launchArguments = ["--offline-ui-test"]; app.launch()
        XCTAssertTrue(app.buttons["retryShop"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["connectionMessage"].label.contains("saved basket"))
        app.buttons["nativeSettings"].tap()
        XCTAssertTrue(app.buttons["enableNativeAlerts"].waitForExistence(timeout: 10))
        reveal(app.buttons["Delete my account"], in: app)
        XCTAssertTrue(app.buttons["Delete my account"].exists)
    }
    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<5 { if element.exists { return }; app.swipeUp() }
    }
}
