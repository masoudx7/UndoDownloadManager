package com.undodownloadmanager.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.undodownloadmanager.app.plugins.YtDlpPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(YtDlpPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
