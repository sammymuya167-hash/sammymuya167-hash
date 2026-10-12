package app.shadownet.routeforge.customer;
import org.junit.Test;
import static org.junit.Assert.*;
public class ShopOriginTest {
 @Test public void onlyOriginalHttpsOriginIsTrusted(){assertTrue(ShopOrigin.trusted(ShopOrigin.ORIGIN+"/shop"));for(String u:new String[]{"http://routeforge-shadownet.sammymuya167.chatgpt.site/shop",ShopOrigin.ORIGIN+":8443/shop","https://routeforge-shadownet.sammymuya167.chatgpt.site.foreign.test/shop","https://user@routeforge-shadownet.sammymuya167.chatgpt.site/shop","file:///shop"})assertFalse(u,ShopOrigin.trusted(u));}
 @Test public void accountAndBusinessRoutesDoNotEnterTheBridgedWebView(){assertTrue(ShopOrigin.shopPage(ShopOrigin.ORIGIN+"/shop/privacy"));assertFalse(ShopOrigin.shopPage(ShopOrigin.ORIGIN+"/merchant"));assertFalse(ShopOrigin.shopPage(ShopOrigin.ORIGIN+"/shopping"));}
 @Test public void courierHandoffIsNotConsumerDelivery(){assertEquals("Your parcel was handed to the courier",ShopOrigin.label("with_courier"));assertEquals("Order completed",ShopOrigin.label("completed"));}
}
