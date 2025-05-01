var objc = JSON.parse($response.body);

objc.purchaseInfo = "SUBSCRIPTION_ACTIVE";

$done({ body: JSON.stringify(objc) });
