//! A set of functions to handle placing market or limit orders,
//! trigger orders and canceling orders using Binance API directly

use reqwest::Client;
use serde_json::Value;
use crate::helpers::Side;
use std::collections::HashMap;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use hex;

type HmacSha256 = Hmac<Sha256>;

fn create_signature(query_string: &str, api_secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(api_secret.as_bytes()).unwrap();
    mac.update(query_string.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Create a market order on Binance
pub(crate) async fn place_market_order(
    client: &Client,
    api_key: &Option<String>,
    api_secret: &Option<String>,
    market_name: &str,
    order_side: Side,
    order_size: rust_decimal::Decimal) -> bool {
    if api_key.is_none() || api_secret.is_none() {
        log::warn!("Cannot place order without API keys");
        return false;
    }
    
    let api_key = api_key.as_ref().unwrap();
    let api_secret = api_secret.as_ref().unwrap();
    let side_str = if order_side == Side::Buy { "BUY" } else { "SELL" };
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    let mut params: HashMap<String, String> = HashMap::new();
    params.insert("symbol".to_string(), market_name.to_string());
    params.insert("side".to_string(), side_str.to_string());
    params.insert("type".to_string(), "MARKET".to_string());
    params.insert("quantity".to_string(), order_size.to_string());
    params.insert("timestamp".to_string(), timestamp.to_string());
    
    let query_string = params.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>().join("&");
    
    let signature = create_signature(&query_string, api_secret);
    let url = format!("https://api.binance.com/api/v3/order?{}&signature={}", query_string, signature);
    
    let response = client.post(&url)
        .header("X-MBX-APIKEY", api_key)
        .send().await;
    
    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                log::info!("Order placed successfully");
                true
            } else {
                log::error!("Order failed: {:?}", resp.text().await);
                false
            }
        }
        Err(e) => {
            log::error!("Unable to place order, Err: {:?}", e);
            false
        }
    }
}

/// Check if position is open on a market
pub(crate) async fn get_open_position(
    client: &Client,
    api_key: &Option<String>,
    api_secret: &Option<String>,
    market_name: &str) -> bool {
    if api_key.is_none() || api_secret.is_none() {
        return false;
    }
    
    let api_key = api_key.as_ref().unwrap();
    let api_secret = api_secret.as_ref().unwrap();
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    let query_string = format!("timestamp={}", timestamp);
    let signature = create_signature(&query_string, api_secret);
    let url = format!("https://api.binance.com/api/v3/account?{}&signature={}", query_string, signature);
    
    let response = client.get(&url)
        .header("X-MBX-APIKEY", api_key)
        .send().await;
    
    match response {
        Ok(resp) => {
            if let Ok(account_info) = resp.json::<Value>().await {
                if let Some(balances) = account_info["balances"].as_array() {
                    let asset = market_name.replace("USDT", "");
                    for balance in balances {
                        if balance["asset"].as_str() == Some(&asset) {
                            let free = balance["free"].as_str().unwrap_or("0");
                            if free.parse::<f64>().unwrap_or(0.0) > 0.0 {
                                log::debug!("Position found: {:?}", balance);
                                return true;
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Unable to get positions: {:?}", e);
        }
    }
    return false;
}


/// Close position at market
pub(crate) async fn market_close_order(
    client: &Client,
    api_key: &Option<String>,
    api_secret: &Option<String>,
    market_name: &str) -> bool {
    if api_key.is_none() || api_secret.is_none() {
        log::warn!("Cannot close order without API keys");
        return false;
    }
    
    let api_key = api_key.as_ref().unwrap();
    let api_secret = api_secret.as_ref().unwrap();
    let asset = market_name.replace("USDT", "");
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    // Get current balance
    let query_string = format!("timestamp={}", timestamp);
    let signature = create_signature(&query_string, api_secret);
    let url = format!("https://api.binance.com/api/v3/account?{}&signature={}", query_string, signature);
    
    let response = client.get(&url)
        .header("X-MBX-APIKEY", api_key)
        .send().await;
    
    let mut balance_amt = 0.0;
    match response {
        Ok(resp) => {
            if let Ok(account_info) = resp.json::<Value>().await {
                if let Some(balances) = account_info["balances"].as_array() {
                    for balance in balances {
                        if balance["asset"].as_str() == Some(&asset) {
                            let free = balance["free"].as_str().unwrap_or("0");
                            let amt = free.parse::<f64>().unwrap_or(0.0);
                            if amt > 0.0 {
                                balance_amt = amt;
                                break;
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Unable to get positions: {:?}", e);
        }
    };
    
    if balance_amt <= 0.0 {
        log::warn!("No balance to close");
        return false;
    }
    
    // Close position
    let timestamp = chrono::Utc::now().timestamp_millis();
    let mut params: HashMap<String, String> = HashMap::new();
    params.insert("symbol".to_string(), market_name.to_string());
    params.insert("side".to_string(), "SELL".to_string());
    params.insert("type".to_string(), "MARKET".to_string());
    params.insert("quantity".to_string(), balance_amt.to_string());
    params.insert("timestamp".to_string(), timestamp.to_string());
    
    let query_string = params.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>().join("&");
    
    let signature = create_signature(&query_string, api_secret);
    let url = format!("https://api.binance.com/api/v3/order?{}&signature={}", query_string, signature);
    
    let response = client.post(&url)
        .header("X-MBX-APIKEY", api_key)
        .send().await;
    
    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                log::info!("Closed order successfully");
                true
            } else {
                log::error!("Unable to close order: {:?}", resp.text().await);
                false
            }
        }
        Err(e) => {
            log::error!("Unable to close order, Err: {:?}", e);
            false
        }
    }
}

/// Cancel all open orders on Binance
pub(crate) async fn cancel_all_trigger_orders(
    client: &Client,
    api_key: &Option<String>,
    api_secret: &Option<String>,
    market_name: &str) -> bool {
    if api_key.is_none() || api_secret.is_none() {
        log::warn!("Cannot cancel orders without API keys");
        return false;
    }
    
    let api_key = api_key.as_ref().unwrap();
    let api_secret = api_secret.as_ref().unwrap();
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    let query_string = format!("symbol={}&timestamp={}", market_name, timestamp);
    let signature = create_signature(&query_string, api_secret);
    let url = format!("https://api.binance.com/api/v3/openOrders?{}&signature={}", query_string, signature);
    
    // First get all open orders
    let response = client.get(&url)
        .header("X-MBX-APIKEY", api_key)
        .send().await;
    
    match response {
        Ok(resp) => {
            if let Ok(orders) = resp.json::<Value>().await {
                if let Some(order_array) = orders.as_array() {
                    for order in order_array {
                        if let Some(order_id) = order["orderId"].as_u64() {
                            let timestamp = chrono::Utc::now().timestamp_millis();
                            let cancel_query = format!("symbol={}&orderId={}&timestamp={}", market_name, order_id, timestamp);
                            let cancel_sig = create_signature(&cancel_query, api_secret);
                            let cancel_url = format!("https://api.binance.com/api/v3/order?{}&signature={}", cancel_query, cancel_sig);
                            
                            let _ = client.delete(&cancel_url)
                                .header("X-MBX-APIKEY", api_key)
                                .send().await;
                        }
                    }
                }
            }
            log::info!("Cancelled all orders");
            true
        }
        Err(e) => {
            log::error!("Unable to cancel orders Err: {:?}", e);
            false
        }
    }
}

/// Place take profit and stop loss orders using OCO (One Cancels the Other)
pub(crate) async fn place_trigger_orders(
    client: &Client,
    api_key: &Option<String>,
    api_secret: &Option<String>,
    market_name: &str,
    order_side: Side,
    order_size: rust_decimal::Decimal,
    tp_price: rust_decimal::Decimal,
    sl_price: rust_decimal::Decimal) -> bool {
    if api_key.is_none() || api_secret.is_none() {
        log::warn!("Cannot place OCO order without API keys");
        return false;
    }
    
    let api_key = api_key.as_ref().unwrap();
    let api_secret = api_secret.as_ref().unwrap();
    let side_str = if order_side == Side::Buy { "SELL" } else { "BUY" };
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    let mut params: HashMap<String, String> = HashMap::new();
    params.insert("symbol".to_string(), market_name.to_string());
    params.insert("side".to_string(), side_str.to_string());
    params.insert("quantity".to_string(), order_size.to_string());
    params.insert("price".to_string(), tp_price.to_string());
    params.insert("stopPrice".to_string(), sl_price.to_string());
    params.insert("stopLimitTimeInForce".to_string(), "GTC".to_string());
    params.insert("timestamp".to_string(), timestamp.to_string());
    
    let query_string = params.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>().join("&");
    
    let signature = create_signature(&query_string, api_secret);
    let url = format!("https://api.binance.com/api/v3/order/oco?{}&signature={}", query_string, signature);
    
    let response = client.post(&url)
        .header("X-MBX-APIKEY", api_key)
        .send().await;
    
    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                log::info!("OCO order (TP/SL) placed successfully");
                true
            } else {
                log::error!("Unable to place OCO order: {:?}", resp.text().await);
                false
            }
        }
        Err(e) => {
            log::error!("Unable to place OCO order, Err: {:?}", e);
            false
        }
    }
}


/// Calculate static TP and SL values
pub(crate) fn calculate_tp_and_sl(
    price: rust_decimal::Decimal,
    side: Side,
    tp_percent: rust_decimal::Decimal,
    sl_percent: rust_decimal::Decimal,
    price_precision: u32) -> (rust_decimal::Decimal, rust_decimal::Decimal) {
    let div = rust_decimal::Decimal::from(100);

    let (tp_price, sl_price) = match side {
        Side::Buy => {
            (price + price * tp_percent / div, price - price * sl_percent / div)
        }
        Side::Sell => {
            (price - price * tp_percent / div, price + price * sl_percent / div)
        }
        Side::None => {
            (price, price)
        }
    };
    return (tp_price.round_dp(price_precision), sl_price.round_dp(price_precision));
}
