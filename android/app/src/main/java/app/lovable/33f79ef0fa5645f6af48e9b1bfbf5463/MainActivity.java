package app.lovable.styleai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.revenuecat.purchases.LogLevel;
import com.revenuecat.purchases.Purchases;
import com.revenuecat.purchases.PurchasesConfiguration;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable debug logs (remove in production)
        Purchases.setLogLevel(LogLevel.DEBUG);

        PurchasesConfiguration configuration =
                new PurchasesConfiguration.Builder(
                        this,
                        "test_dcpunFsYSVMqwTpHJzaeQPXBUhE"
                ).build();

        Purchases.configure(configuration);
    }
}
