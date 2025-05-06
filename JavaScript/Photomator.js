// Path: Scripts/Photomator.js
const obj = {
  request_date_ms: 1695823444784,
  request_date: "2023-09-27T14:04:04Z",
  subscriber: {
    non_subscriptions: {},
    first_seen: "2023-09-27T13:53:14Z",
    original_application_version: "187",
    other_purchases: {},
    management_url: "https://apps.apple.com/account/subscriptions",
    subscriptions: {
      pixelmator_photo_lifetime_v1: {
        unsubscribe_detected_at: null,
        expires_date: "2099-10-27T14:03:52Z",
        is_sandbox: false,
        refunded_at: null,
        auto_resume_date: null,
        original_purchase_date: "2023-09-27T14:03:55Z",
        grace_period_expires_date: null,
        period_type: "normal",
        purchase_date: "2023-09-27T14:03:52Z",
        billing_issues_detected_at: null,
        ownership_type: "PURCHASED",
        store: "app_store",
        store_transaction_id: "190001736542492",
      },
    },
    entitlements: {
      pixelmator_photo_pro_access: {
        grace_period_expires_date: null,
        purchase_date: "2023-09-27T14:03:52Z",
        product_identifier: "pixelmator_photo_lifetime_v1",
        expires_date: "2099-10-27T14:03:52Z",
      },
    },
    original_purchase_date: "2023-09-27T13:52:21Z",
    original_app_user_id: "$RCAnonymousID:906cabee1f0a4e189ade2f5060582ab6",
    last_seen: "2023-09-27T13:53:14Z",
  },
};

$done({ body: JSON.stringify(obj) });
