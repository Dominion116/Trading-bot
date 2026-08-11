# Create comprehensive PDF documentation for bot update process
$pdfPath = "docs\trading_bot.pdf"

# Create HTML content with detailed update instructions
$html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Trading Bot Update Guide</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }
        h3 { color: #7f8c8d; margin-top: 20px; }
        .step { background-color: #ecf0f1; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .code { background-color: #2c3e50; color: #ecf0f1; padding: 10px; border-radius: 3px; font-family: monospace; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .info { background-color: #d1ecf1; border: 1px solid #17a2b8; padding: 15px; border-radius: 5px; margin: 10px 0; }
        ul { margin: 10px 0; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
    <h1>Trading Bot Update Guide</h1>
    
    <div class="info">
        <strong>Important:</strong> Always backup your current configuration and settings before performing any updates.
    </div>

    <h2>1. Pre-Update Checklist</h2>
    <div class="step">
        <ul>
            <li>Backup <code>settings.json</code> file</li>
            <li>Backup <code>.env</code> file (if using live trading)</li>
            <li>Stop the currently running bot instance</li>
            <li>Check current version in <code>Cargo.toml</code></li>
            <li>Review recent changes in Git history if applicable</li>
        </ul>
    </div>

    <h2>2. Updating Rust Dependencies</h2>
    <div class="step">
        <h3>Step 1: Update Cargo.toml</h3>
        <p>Edit <code>Cargo.toml</code> to update dependency versions:</p>
        <div class="code">
            [dependencies]<br>
            reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }<br>
            tokio = { version = "1.35",  features = ["full"] }<br>
            <!-- Update other dependencies as needed -->
        </div>
    </div>

    <div class="step">
        <h3>Step 2: Update dependencies</h3>
        <p>Run the following command to update dependencies:</p>
        <div class="code">
            cargo update
        </div>
    </div>

    <h2>3. Rebuilding the Bot</h2>
    <div class="step">
        <h3>Step 1: Clean previous build</h3>
        <div class="code">
            cargo clean
        </div>
    </div>

    <div class="step">
        <h3>Step 2: Build release version</h3>
        <div class="code">
            cargo build --release
        </div>
    </div>

    <div class="step">
        <h3>Step 3: Verify build</h3>
        <p>Ensure <code>target\release\orderbook-delta-bot.exe</code> was created successfully.</p>
    </div>

    <h2>4. Updating Bot Code</h2>
    <div class="step">
        <h3>Modifying Source Files</h3>
        <ul>
            <li><code>src/main.rs</code> - Main bot logic and trading loop</li>
            <li><code>src/helpers.rs</code> - Helper functions and utilities</li>
            <li><code>src/order_handler.rs</code> - Binance API integration</li>
            <li><code>src/tests.rs</code> - Test functions</li>
        </ul>
    </div>

    <div class="step">
        <h3>Common Code Updates</h3>
        <ul>
            <li>Adjusting Bollinger Band parameters</li>
            <li>Modifying orderbook depth settings</li>
            <li>Updating API endpoints</li>
            <li>Adding new trading strategies</li>
            <li>Improving error handling</li>
        </ul>
    </div>

    <h2>5. Updating Configuration</h2>
    <div class="step">
        <h3>Settings File (settings.json)</h3>
        <p>Update the following parameters as needed:</p>
        <ul>
            <li><code>market_name</code> - Trading pair (e.g., "BTCUSDT")</li>
            <li><code>sampling_time</code> - Orderbook sampling interval in seconds</li>
            <li><code>bb_period</code> - Bollinger Band period</li>
            <li><code>bb_std_dev</code> - Bollinger Band standard deviation</li>
            <li><code>orderbook_depth</code> - Depth of orderbook to analyze</li>
            <li><code>live</code> - Set to true for live trading</li>
            <li><code>order_size</code> - Size of each order</li>
            <li><code>tp_percent</code> - Take profit percentage</li>
            <li><code>sl_percent</code> - Stop loss percentage</li>
        </ul>
    </div>

    <h2>6. Updating Documentation Files</h2>
    <div class="step">
        <h3>PDF Documentation</h3>
        <p>To update this PDF:</p>
        <ol>
            <li>Edit <code>create_pdf.ps1</code> with new content</li>
            <li>Run: <code>powershell -ExecutionPolicy Bypass -File create_pdf.ps1</code></li>
            <li>The new PDF will be generated in <code>docs\trading_bot.pdf</code></li>
        </ol>
    </div>

    <div class="step">
        <h3>VBS Script</h3>
        <p>The VBS script in <code>docs\open_pdf.vbs</code> opens the PDF automatically. Update the path if you change the PDF location.</p>
    </div>

    <h2>7. Testing the Update</h2>
    <div class="step">
        <h3>Pre-Launch Testing</h3>
        <ul>
            <li>Run the bot in paper trading mode first (<code>"live": false</code>)</li>
            <li>Monitor logs for errors or warnings</li>
            <li>Verify orderbook data is being received correctly</li>
            <li>Check that Bollinger Bands are calculating properly</li>
            <li>Test position entry/exit logic if possible</li>
        </ul>
    </div>

    <div class="step">
        <h3>Launch Test</h3>
        <div class="code">
            run_bot.bat
        </div>
    </div>

    <h2>8. Rollback Procedure</h2>
    <div class="warning">
        <strong>If the update causes issues:</strong>
    </div>
    <div class="step">
        <ol>
            <li>Stop the bot immediately</li>
            <li>Restore backed-up <code>settings.json</code></li>
            <li>Revert code changes using Git or restore from backup</li>
            <li>Rebuild with: <code>cargo build --release</code></li>
            <li>Test the rollback before going live</li>
        </ol>
    </div>

    <h2>9. Version Management</h2>
    <div class="step">
        <h3>Version Tracking</h3>
        <ul>
            <li>Update version in <code>Cargo.toml</code></li>
            <li>Document changes in a CHANGELOG</li>
            <li>Tag releases in Git if using version control</li>
            <li>Keep previous builds for rollback capability</li>
        </ul>
    </div>

    <h2>10. Troubleshooting</h2>
    <div class="step">
        <h3>Common Issues</h3>
        <ul>
            <li><strong>Build fails:</strong> Check Rust version and dependencies</li>
            <li><strong>API errors:</strong> Verify Binance API is accessible and keys are valid</li>
            <li><strong>Network issues:</strong> The bot now has retry logic built-in</li>
            <li><strong>Configuration errors:</strong> Validate JSON syntax in settings.json</li>
        </ul>
    </div>

    <h2>11. Security Considerations</h2>
    <div class="warning">
        <ul>
            <li>Never commit <code>.env</code> files with API keys</li>
            <li>Keep API keys secure and rotate them regularly</li>
            <li>Test updates in paper trading mode before live trading</li>
            <li>Monitor for unusual bot behavior after updates</li>
        </ul>
    </div>

    <h2>12. Contact and Support</h2>
    <div class="step">
        <p>For issues or questions about updates:</p>
        <ul>
            <li>Check the project repository for issues</li>
            <li>Review logs for error messages</li>
            <li>Consult the main README.md for general information</li>
        </ul>
    </div>

    <div class="info">
        <strong>Last Updated:</strong> August 2026<br>
        <strong>Bot Version:</strong> 0.3.1
    </div>
</body>
</html>
"@

# Save HTML version for reference
$html | Out-File -FilePath "temp_update.html" -Encoding UTF8

# Create a proper PDF file with update guide content
$pdfContent = @"
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 600
>>
stream
BT
/F1 16 Tf
50 750 Td
(Trading Bot Update Guide) Tj
/F1 12 Tf
50 720 Td
(This document provides detailed instructions for updating the trading bot.) Tj
50 700 Td
(1. Pre-Update Checklist) Tj
50 680 Td
(- Backup settings.json and .env files) Tj
50 660 Td
(- Stop running bot instance) Tj
50 640 Td
(- Check current version) Tj
50 620 Td
(2. Updating Dependencies) Tj
50 600 Td
(- Edit Cargo.toml for dependency versions) Tj
50 580 Td
(- Run: cargo update) Tj
50 560 Td
(3. Rebuilding the Bot) Tj
50 540 Td
(- Run: cargo clean) Tj
50 520 Td
(- Run: cargo build --release) Tj
50 500 Td
(4. Updating Bot Code) Tj
50 480 Td
(- Modify src/main.rs, src/helpers.rs, src/order_handler.rs) Tj
50 460 Td
(5. Updating Configuration) Tj
50 440 Td
(- Edit settings.json with new parameters) Tj
50 420 Td
(6. Testing) Tj
50 400 Td
(- Test in paper trading mode first) Tj
50 380 Td
(- Monitor logs for errors) Tj
50 360 Td
(7. Rollback Procedure) Tj
50 340 Td
(- Restore backups if issues occur) Tj
50 320 Td
(- Revert code changes) Tj
50 300 Td
(8. Version Management) Tj
50 280 Td
(- Update version in Cargo.toml) Tj
50 260 Td
(- Document changes in CHANGELOG) Tj
50 240 Td
(For detailed HTML version, see temp_update.html) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000264 00000 n 
0000000372 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
447
%%EOF
"@

# Save as temp_update.pdf
try {
    $pdfContent | Out-File -FilePath "temp_update.pdf" -Encoding ASCII -NoNewline
    Write-Host "Successfully created temp_update.pdf"
} catch {
    Write-Host "Error creating temp_update.pdf: $_"
}

# Ensure docs directory exists
if (-not (Test-Path "docs")) {
    New-Item -ItemType Directory -Path "docs" | Out-Null
}

# Also save to docs directory
$pdfContent | Out-File -FilePath $pdfPath -Encoding ASCII
Write-Host "PDF created: $pdfPath"
Write-Host "PDF also created as: temp_update.pdf"
Write-Host "HTML version saved as: temp_update.html.lnk"
