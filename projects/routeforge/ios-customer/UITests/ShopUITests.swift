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
        XCTAssertTrue(app.staticTexts["1.0 (1)"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Privacy & data"].exists)
        XCTAssertTrue(app.buttons["Delete my account"].exists)
        XCTAssertTrue(app.buttons["enableNativeAlerts"].exists)
        XCTAssertTrue(app.staticTexts["Your orders refresh while the app is open. Notifications after closing the app are not enabled in this build."].exists)
    }
    func testOfflineScreenAllowsRetryAndKeepsNativeNavigation() {
        let app = XCUIApplication(); app.launchArguments = ["--offline-ui-test"]; app.launch()
        XCTAssertTrue(app.buttons["retryShop"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["connectionMessage"].label.contains("saved basket"))
        app.buttons["nativeSettings"].tap()
        XCTAssertTrue(app.buttons["Delete my account"].waitForExistence(timeout: 10))
    }
}
