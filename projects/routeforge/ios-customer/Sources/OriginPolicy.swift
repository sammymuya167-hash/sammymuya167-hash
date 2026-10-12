import Foundation

enum ShopOrigin {
    static let host = "routeforge-shadownet.sammymuya167.chatgpt.site"
    static let base = URL(string: "https://" + host)!
    static let shop = base.appendingPathComponent("shop")
    static let cookieName = "__Host-routeforge-customer"

    static func isFirstParty(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && url.host?.lowercased() == host
        && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    static func isShopPage(_ url: URL) -> Bool {
        guard isFirstParty(url) else { return false }
        let path = url.path.removingPercentEncoding ?? url.path
        guard !path.contains("\\"), !path.split(separator: "/").contains("..") else { return false }
        return path == "/shop" || path.hasPrefix("/shop/")
    }

    static func isAPI(_ url: URL) -> Bool {
        isFirstParty(url) && ["/api/customer/session", "/api/customer/orders", "/api/customer/logout"].contains(url.path)
    }

    static func isExternalLink(_ url: URL) -> Bool {
        guard !isFirstParty(url), url.user == nil, url.password == nil else { return false }
        return url.scheme?.lowercased() == "https" && url.host != nil
    }

    static func sessionCookie(in cookies: [HTTPCookie], now: Date = Date()) -> HTTPCookie? {
        cookies.first {
            $0.name == cookieName && $0.domain == host && $0.path == "/"
            && $0.isSecure && $0.isHTTPOnly && !$0.value.isEmpty
            && ($0.expiresDate == nil || $0.expiresDate! > now)
        }
    }
}
