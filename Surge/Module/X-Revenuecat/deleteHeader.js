/**
 * @longthinh
 > Name：deleteHeader
 > Update：2024-02-03
 > Me：https://t.me/longthinh
 > Channel：https://t.me/Share2Get
 > Contact：share2get@icloud.com
*/

const version = "1.0.2";

function setHeaderValue(e, a, d) {
  var r = a.toLowerCase();
  r in e ? (e[r] = d) : (e[a] = d);
}
var modifiedHeaders = $request.headers;
setHeaderValue(modifiedHeaders, "X-RevenueCat-ETag", ""),
  $done({ headers: modifiedHeaders });
