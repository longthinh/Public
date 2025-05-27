// Radarbot.js
let body = $request.body;
let url = $request.url;

let response = {
  request_date_ms: 1703230264000,
  request_date: "2025-01-01T01:01:01Z",
  subscriber: {
    entitlement: {},
    first_seen: "2025-01-01T01:01:01Z",
    original_application_version: "1998",
    last_seen: "2025-01-01T01:01:01Z",
    other_purchases: {},
    management_url: null,
    subscriptions: {
      rb_truck_999_monthly_trial_1w0: {
        store: "app_store",
        is_sandbox: false,
        ownership_type: "PURCHASED",
        original_purchase_date: "2025-01-01T01:01:01Z",
        purchase_date: "2025-01-01T01:01:01Z",
        expires_date: "2099-01-01T01:01:01Z",
      },
      rb_pro_199_monthly_offer_3m099: {
        store: "app_store",
        is_sandbox: false,
        ownership_type: "PURCHASED",
        original_purchase_date: "2025-01-01T01:01:01Z",
        purchase_date: "2025-01-01T01:01:01Z",
        expires_date: "2099-01-01T01:01:01Z",
      },
      rb_gold_3599_annual_trial_2w0: {
        store: "app_store",
        is_sandbox: false,
        ownership_type: "PURCHASED",
        original_purchase_date: "2025-01-01T01:01:01Z",
        purchase_date: "2025-01-01T01:01:01Z",
        expires_date: "2099-01-01T01:01:01Z",
      },
    },
    entitlements: {
      truck_access: {
        ownership_type: "PURCHASED",
        is_sandbox: false,
        product_identifier: "rb_truck_999_monthly_trial_1w0",
        expires_date: "2099-01-01T01:01:01Z",
        original_purchase_date: "2025-01-01T01:01:01Z",
        purchase_date: "2025-01-01T01:01:01Z",
        store: "app_store",
      },
      pro_access: {
        ownership_type: "PURCHASED",
        is_sandbox: false,
        product_identifier: "rb_pro_199_monthly_offer_3m099",
        expires_date: "2099-01-01T01:01:01Z",
        original_purchase_date: "2025-01-01T01:01:01Z",
        purchase_date: "2025-01-01T01:01:01Z",
        store: "app_store",
      },
      gold_access: {
        ownership_type: "PURCHASED",
        is_sandbox: false,
        product_identifier: "rb_gold_3599_annual_trial_2w0",
        expires_date: "2099-01-01T01:01:01Z",
        original_purchase_date: "2025-01-01T01:01:01Z",
        purchase_date: "2025-01-01T01:01:01Z",
        store: "app_store",
      },
    },
    original_purchase_date: "2025-01-01T01:01:01Z",
    original_app_user_id: "48F96E67-2041-6E68-0000-000000000000",
    non_subscriptions: {},
  },
};

$done({
  body: JSON.stringify(response),
  headers: {
    "Content-Type": "application/json",
  },
});
