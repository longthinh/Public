var objc = JSON.parse($response.body);

objc = {
  result: {
    success: true,
    message: "Get User premium success",
    data: {
      premium: "yearly",
      entitled_features: {
        muslimpro: true,
        qalbox: true,
      },
      last_updated_timestamp: 1710108518022,
      expiry: 4076864331000,
      expiry_grace: 4076864331000,
      active_sku: "com.bitsmedia.muslimpro.qalbox.yearly",
      platform: "apple",
      purchase_timestamp: 1710108418000,
      free_trial: false,
      free_trial_completed: false,
      token: null,
      claimed_campaigns: [],
      tier: "FULL_PREMIUM",
    },
  },
};

$done({ body: JSON.stringify(objc) });
