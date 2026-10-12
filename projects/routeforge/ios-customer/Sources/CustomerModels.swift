import Foundation
import CoreLocation

struct ShopCustomer: Decodable, Equatable { let id: String; let name: String }
struct SessionResponse: Decodable { let customer: ShopCustomer? }
struct OrdersResponse: Decodable { let orders: [ShopOrder] }
struct RiderPin: Decodable, Equatable {
    let lat: Double; let lng: Double; let at: Double
    func coordinate(now: Date = Date()) -> CLLocationCoordinate2D? {
        let age = now.timeIntervalSince1970 * 1000 - at
        guard lat.isFinite, lng.isFinite, (-90...90).contains(lat), (-180...180).contains(lng),
              age >= -5000, age <= 90000 else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}
struct ShopOrder: Decodable, Identifiable, Equatable {
    let id: String
    let reference: String
    let storeName: String
    let status: String
    let totalMinor: Int
    let createdAt: Double
    let deliveryOtp: String?
    let rider: String?
    let riderLocation: RiderPin?
    var date: Date { Date(timeIntervalSince1970: createdAt / 1000) }
    var statusTitle: String {
        Self.statusTitles[status] ?? "Order update"
    }
    static let statusTitles = [
        "placed": "Order received", "quoted": "Confirm delivery quote", "accepted": "Preparing your order",
        "dispatching": "Preparing dispatch", "awaiting_rider": "Finding a rider",
        "rider_to_pickup": "Rider heading to pickup", "at_pickup": "Rider collecting your order",
        "on_delivery": "On the way", "at_destination": "Rider has arrived",
        "with_courier": "Handed to courier", "completed": "Completed", "cancelled": "Cancelled",
        "delivery_issue": "Merchant reviewing delivery"
    ]
    var money: String { String(format: "KES %.2f", Double(totalMinor) / 100) }
}

struct OrderChanges {
    private(set) var customerID: String?
    private var statuses: [String: String] = [:]
    mutating func clear() { customerID = nil; statuses.removeAll() }
    mutating func updates(customerID: String, orders: [ShopOrder]) -> [ShopOrder] {
        guard self.customerID == customerID else {
            self.customerID = customerID
            statuses = Dictionary(orders.map { ($0.id, $0.status) }, uniquingKeysWith: { _, b in b })
            return []
        }
        let changed = orders.filter { statuses[$0.id] != nil && statuses[$0.id] != $0.status }
        statuses = Dictionary(orders.map { ($0.id, $0.status) }, uniquingKeysWith: { _, b in b })
        return changed
    }
}
