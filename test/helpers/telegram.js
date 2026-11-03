import crypto from "node:crypto";

// Підпис initData за офіційним алгоритмом Telegram, незалежно від бібліотеки, яку перевіряють тести:
// secret = HMAC_SHA256("WebAppData", token), hash = HMAC_SHA256(secret, рядки "ключ=значення" за абеткою)
export function signInitData(token, { user, authDate = Math.floor(Date.now() / 1000), extra = {} } = {}) {
    const fields = { auth_date: String(authDate), query_id: "AAH-test", user: JSON.stringify(user), ...extra };
    const checkString = Object.keys(fields).sort().map(key => `${key}=${fields[key]}`).join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
    const hash = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
    return new URLSearchParams({ ...fields, hash }).toString();
}

export const TEST_TOKEN = "123456789:TEST_token_for_unit_tests_only";
