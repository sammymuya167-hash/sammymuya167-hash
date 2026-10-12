package app.shadownet.routeforge.customer;
import java.net.URI;
final class ShopOrigin {
 static final String ORIGIN="https://routeforge-shadownet.sammymuya167.chatgpt.site";
 static boolean trusted(String value){try{URI u=new URI(value);return "https".equals(u.getScheme())&&"routeforge-shadownet.sammymuya167.chatgpt.site".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&u.getUserInfo()==null;}catch(Exception e){return false;}}
 static boolean shopPage(String value){if(!trusted(value))return false;try{String p=new URI(value).getPath();return p.equals("/shop")||p.startsWith("/shop/");}catch(Exception e){return false;}}
 static String label(String status){switch(status){case "quoted":return "Confirm your delivery quote";case "accepted":return "Your shop is preparing the order";case "awaiting_rider":return "Finding a rider";case "rider_to_pickup":return "Rider heading to pickup";case "at_pickup":return "Rider collecting your order";case "on_delivery":return "Your order is on the way";case "at_destination":return "Your rider has arrived";case "with_courier":return "Your parcel was handed to the courier";case "completed":return "Order completed";case "cancelled":return "Order cancelled";default:return "Your order has an update";}}
}
