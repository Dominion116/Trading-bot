//! A trading bot written in Rust.
//!
//! © Dinesh Pinto, 2022
//! LICENSE: Apache-2.0, see http://www.apache.org/licenses/LICENSE-2.0
//!
//! Uses a trading strategy based on counter trading large deviations in
//! the delta volume (i.e. bid volume - ask volume) on the futures orderbook.
//!
//! The bot waits for deviations outside a specified standard deviation of a bollinger band
//! and enters a long/short position accordingly.
//!
//! A full analysis of this strategy is given in
//! [dineshpinto/market-analytics](https://github.com/dineshpinto/market-analytics)

mod helpers;
mod order_handler;
mod tests;

use std::str::FromStr;
use reqwest::Client;
use serde_json::Value;

/// Core logical loop for the bot.
///
/// The process is:
/// 1. Set up asynchronous connection to the FTX API
/// 2. Wait for N time steps, where N is the length of the bollinger band.
/// 3. Set the trigger to ready the bot
/// 4. Enter a long/short position based on the entry conditions specified in settings
/// 5. Exit by either hitting the take profit/stop loss or by switching sides
///
/// Note: For risk management purposes, in case the bot is unable to place TP/SL after
/// opening a position it will close the open position and panic.
///
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load settings file
    let settings_filepath = String::from("settings.json");
    let settings = helpers::read_settings(&settings_filepath);

    // Set up logging
    let mut builder = env_logger::Builder::new();
    builder
        .filter(None, log::LevelFilter::Info)
        .write_style(env_logger::WriteStyle::Always)
        .target(env_logger::Target::Stdout)
        .init();

    log::info!("Settings file loaded from {:?}.", settings_filepath);
    log::info!("{:?}", settings);

    // Set up HTTP client for Binance API
    let client = Client::new();
    let api_key = if settings.live {
        dotenv::dotenv().ok();
        Some(std::env::var("BINANCE_API_KEY").expect("BINANCE_API_KEY not set"))
    } else {
        None
    };
    let api_secret = if settings.live {
        Some(std::env::var("BINANCE_API_SECRET").expect("BINANCE_API_SECRET not set"))
    } else {
        None
    };

    // Get exchange info for price and size precision with retry logic
    let exchange_info: Value = helpers::retry_async(
        || {
            client.get("https://api.binance.com/api/v3/exchangeInfo")
                .send()
        },
        5,
        1000,
    ).await?.json().await?;
    
    // Find the symbol in exchange info
    let symbol_info = exchange_info["symbols"].as_array()
        .and_then(|symbols| symbols.iter()
            .find(|s| s["symbol"].as_str() == Some(&settings.market_name)))
        .ok_or_else(|| format!("Symbol '{}' not found in exchange info. Binance may be blocking requests from your location.", settings.market_name))?;
    
    // Set precision for price
    let price_precision = symbol_info["quotePrecision"].as_u64()
        .ok_or("quotePrecision missing")? as u32;
    
    // Set precision for order size
    let size_precision = symbol_info["baseAssetPrecision"].as_u64()
        .ok_or("baseAssetPrecision missing")? as u32;
    
    // Round order size to appropriate precision
    let _order_size = settings.order_size.round_dp(size_precision);
    
    log::info!("Order size and precision check...PASS");

    // Set up bollinger bands
    let mut bollinger_bands = ta::indicators::BollingerBands::new(
        settings.bb_period,
        settings.bb_std_dev,
    ).unwrap();

    // Set up loop outer variables
    let mut count: usize = 0;
    let mut positions_count: usize = 0;
    let mut current_side: helpers::Side = helpers::Side::default();
    let mut price = rust_decimal::Decimal::default();

    log::info!("Setting trigger after {:?} samples, each sample is {:?}s (total = {:?}s)...",
        settings.bb_period,
        settings.sampling_time,
        settings.bb_period as u64 * settings.sampling_time
    );

    loop {
        count += 1;
        let mut bid_ask_delta = 0.0;

        for _ in 0..settings.sampling_time {
            // Get orderbook with retry logic
            let order_book: Value = helpers::retry_async(
                || {
                    client.get("https://api.binance.com/api/v3/depth")
                        .query(&[("symbol", &settings.market_name), ("limit", &settings.orderbook_depth.to_string())])
                        .send()
                },
                5,
                1000,
            ).await?.json().await?;

            // Calculate values used for analysis
            let mut total_bid_volume = rust_decimal::Decimal::from(0);
            let mut total_ask_volume = rust_decimal::Decimal::from(0);

            for idx in 0..settings.orderbook_depth as usize {
                if let Some(bid) = order_book["bids"].as_array().and_then(|b| b.get(idx)) {
                    if let Some(qty) = bid.get(1).and_then(|v| v.as_str()) {
                        total_bid_volume += rust_decimal::Decimal::from_str(qty).unwrap_or(rust_decimal::Decimal::from(0));
                    }
                }
                if let Some(ask) = order_book["asks"].as_array().and_then(|a| a.get(idx)) {
                    if let Some(qty) = ask.get(1).and_then(|v| v.as_str()) {
                        total_ask_volume += rust_decimal::Decimal::from_str(qty).unwrap_or(rust_decimal::Decimal::from(0));
                    }
                }
            }
            bid_ask_delta += rust_decimal::prelude::ToPrimitive::to_f64(
                &(total_bid_volume - total_ask_volume)).unwrap();

            log::debug!("bid_ask_delta={:.2}", &bid_ask_delta);

            std::thread::sleep(std::time::Duration::from_secs(1));
        }

        let bb = ta::Next::next(&mut bollinger_bands, bid_ask_delta);

        log::info!("bid_ask_delta={:.2}, bb_lower={:.2}, bb_upper={:.2}",
            bid_ask_delta, bb.lower, bb.upper);

        // Only perform further calculation if bb_period is passed
        if count > settings.bb_period {
            if count == settings.bb_period + 1 {
                log::info!("Trigger is now set...")
            }

            // Entry conditions
            if bid_ask_delta > bb.upper || bid_ask_delta < bb.lower {
                // Get current price with retry logic
                let price_result: Value = helpers::retry_async(
                    || {
                        client.get("https://api.binance.com/api/v3/ticker/price")
                            .query(&[("symbol", &settings.market_name)])
                            .send()
                    },
                    5,
                    1000,
                ).await?.json().await?;
                let current_price = rust_decimal::Decimal::from_str(
                    price_result["price"].as_str().ok_or("Price field missing")?
                )?;
                
                // For simplicity, use same price for bid/ask (in live trading, get orderbook for precise prices)
                let bid_price = current_price;
                let ask_price = current_price;

                // Create local variables to handle side
                let mut _side: helpers::Side = helpers::Side::Buy;

                if bid_ask_delta > bb.upper {
                    // Enter short position
                    _side = helpers::Side::Sell;
                    price = bid_price;

                    // Continue if we are already on the same side, else change side
                    if _side == current_side { continue; } else { current_side = _side }

                    log::info!(
                        "Bid-ask delta above upper bb, {:?} at {:?}",
                        _side, price
                    );
                } else if bid_ask_delta < bb.lower {
                    // Enter long position
                    _side = helpers::Side::Buy;
                    price = ask_price;

                    // Continue if we are already on the same side, else change side
                    if _side == current_side { continue; } else { current_side = _side }

                    log::info!(
                        "Bid-ask delta below lower bb, {:?} at {:?}",
                        _side, price
                    );
                }

                // Map our Side enum onto order handler Side enum
                let order_side = current_side;

                // Calculate static TP and SL for order
                // TODO: Use dynamic TP and SL based on market movements
                let (tp_price, sl_price) = order_handler::calculate_tp_and_sl(
                    price, order_side, settings.tp_percent, settings.sl_percent, price_precision);
                log::info!(
                    "{:?} {:?} {} at {:?}. Take profit at {:?} ({:?}%) and \
                    stop loss at {:?} ({:?}%)",
                    current_side, _order_size, settings.market_name, price, tp_price,
                    settings.tp_percent, sl_price, settings.sl_percent
                );
                positions_count += 1;

                if settings.live {
                    // Check if position is currently open and close it
                    let open_position = order_handler::get_open_position(&client, &api_key, &api_secret, &settings.market_name).await;

                    if open_position {
                        log::info!("Closing existing position...");
                        order_handler::market_close_order(
                            &client, &api_key, &api_secret, &settings.market_name,
                        ).await;
                    }
                    order_handler::cancel_all_trigger_orders(
                        &client, &api_key, &api_secret, &settings.market_name,
                    ).await;

                    // Place order on Binance
                    let order_placed = order_handler::place_market_order(
                        &client, &api_key, &api_secret, &settings.market_name,
                        order_side,
                        _order_size,
                    ).await;

                    if !order_placed {
                        log::warn!("Unable to place order, will continue with loop...");
                        continue;
                    }

                    // Place trigger orders on Binance
                    let triggers_placed = order_handler::place_trigger_orders(
                        &client, &api_key, &api_secret, &settings.market_name,
                        order_side,
                        _order_size,
                        tp_price,
                        sl_price,
                    ).await;

                    // If unable to place TP or SL, cancel all orders
                    if !triggers_placed {
                        log::warn!("Cancelling all orders...");
                        let order_closed = order_handler::market_close_order(&client, &api_key, &api_secret, &settings.market_name).await;
                        let triggers_cancelled = order_handler::cancel_all_trigger_orders(&client, &api_key, &api_secret, &settings.market_name).await;

                        if order_closed && triggers_cancelled {
                            continue;
                        } else {
                            log::error!("Unable to close order, skipping this trade");
                            continue;
                        }
                    }
                }

                // Write the positions to a csv
                if settings.write_to_file {
                    helpers::write_to_csv(
                        "positions.csv",
                        price,
                        _order_size,
                        &current_side,
                        positions_count,
                    ).expect("Unable to write positions to file.");
                }
            }
        }
    }
}
