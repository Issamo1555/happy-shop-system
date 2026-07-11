import Database from "better-sqlite3";
import fs from "fs";

const email = "posetrdv@parentalite-498421.iam.gserviceaccount.com";
const key = "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD6rZ2ye5R3345D\\nKconJm8LmH6uqUM461u1UBozWauA47XGiaP5ix9Z+yqQmbOT+5U2ErSV7K0S3Yn5\\n/2BWJF/XMF3VnYtBBo5YywxMj5y6vvtjHL91QRwuzM4bmvm8p1pnsbfsJvr28HzP\\nJXgGQFwcdqudq+UZtaz1xiZAUOX8OQF23NkuLaZLrk+8myWWoOj4vla4QRS2gmJu\\nWQ7Gdw86k2JAd06LXwXcoxl2ektA9yffEnBOHbxDDMnAabvqnCgZlXm6/YYkJb+E\\n/I39+Xd2Ee1aM+Q/gLkQhcc71WGQg7RnyBHmVGOYNgL54yVubHCweeDgp93rBc7L\\nZAPUcX4nAgMBAAECggEATjwAEvORpwXMyvZQYn6Suo45vz4RPkLqCMC6pJsQNPYc\\nRZ2wYNHEE5uZMa7ehklGzKzy0jWe4Fvm03CZuti4VpsANgpoqv8mTtzz9jL96aRw\\nJYMT177d0ldV3fS0i2W5h9JFwfx6Z7YvZaDegCj29mUs81Tx99+k3sGcL4dv95Ke\\n3AFutnKtEDFabwaBoF8GUoaHoPN8k3g/KT2eiGu/apZJs0ZXYGuYhPyOHPe1X7wb\\nVeZ0uSzXaxmNqLxBV44WQjs36BwRTcrMtnCiGk0RUUrzN/SU+MgdVH3VfdF6z+Xx\\nkktfypO1mBh3ktYG29xQWJ8fmqVACugGDK1abFpEjQKBgQD+SuBaOXUo+CLuv9mJ\\n/xIItp0zPwSj0L2ltVKHc449vr4D0MHhyONQK8LOa9qCArsNm0Hj5AuXxv4Dy2wv\\nsAVs04Z4hxkhZjvsMW7aNgVcAy4cvjwf55uU+LdXW5M9NxtDXS3fqAMCYCZ7KLot\\nnCbPWG/76N2x+899Ol1F1RsLCwKBgQD8XIbXSMMVmZragjLNZtl1JOMgCcJYXchC\\nRU2y0spH45V7jfQcPV+0m3QogLXfd2CxXD4bgqbgp2BpxYezWCcm6LHARVV0Edbl\\nCkEdeZMy9+1tW2SdbqRmSjHNpTt7U2jWEbS5J/bF258dPOK7IbqZBxctciMqaWgv\\nBorH0FSq1QKBgQDJoJ0bbQuUnIs2OzBF1tV5yzIB/Cm1qkF1LrxtYhaapq8LX28b\\nk6mJW+luut3a0Ed4lm48QAlhIwst/xGdDjh+/YlV7+jhLqq8sMVwh/zf5DWf3MbX\\nlVErYbodriKlGxim5S8Gc7VPIOXiKXzVxUaQiVLhrtZ51WvDo49pW3vB2QKBgE+S\\n+W2+4szXz41hCpXb/WvDwt5iVWa5w6Cp67McZm4+o+7+tt+Etr3jWsA+vZqGMPYc\\nCPVxwB8MiAkyIPT7MfVB4HKpKiXcTi+QiTG7GSA0LyiRbet6bNpYQNYAaP4dMex2\\nTs8ne9etxcFZZoDtRMJmCvfoipAgBpr1bCNPXLM1AoGBAM2YIHqVweFFzDycsAIO\\nlFGjDbTjpldKmriB7N6Ku/WuPw+y3bXGlQUuhDOc9vzYSHFLZJbkk/fUS4LOdd4r\\nCgZxLgsowLp2k6VDsw8flXbH+/aoOT8cNhOofJ0Xxa8eSGL2GwSnuw0vTmVLx1Wr\\nD8IWxVT6SJczu+0QM3hc3W5p\\n-----END PRIVATE KEY-----\\n";

try {
  let envStr = fs.readFileSync(".env", "utf8");
  envStr = envStr.replace(/GOOGLE_CLIENT_EMAIL=.*/, "GOOGLE_CLIENT_EMAIL=" + email);
  envStr = envStr.replace(/GOOGLE_PRIVATE_KEY=.*/, "GOOGLE_PRIVATE_KEY=\"" + key + "\"");
  fs.writeFileSync(".env", envStr);
  console.log(".env updated");

  const db = new Database("pos.db");
  db.prepare("REPLACE INTO settings ('key', value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run("google_client_email", email);
  db.prepare("REPLACE INTO settings ('key', value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run("google_private_key", key);
  console.log("pos.db updated");
} catch (err) {
  console.error(err);
  process.exit(1);
}
