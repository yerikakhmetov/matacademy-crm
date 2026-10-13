import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDevice, isLoginToken } from "./device.ts";

const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WIN_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0";

test("устройство: браузер, система и город", () => {
  assert.equal(describeDevice(MAC_CHROME, "Almaty", "1.2.3.4"), "Chrome · macOS · Almaty");
  assert.equal(describeDevice(IPHONE_SAFARI, null, "5.6.7.8"), "Safari · iPhone · IP 5.6.7.8");
  assert.equal(describeDevice(WIN_EDGE, null, null), "Edge · Windows");
});

test("устройство: город из заголовка Vercel декодируется", () => {
  assert.equal(describeDevice(MAC_CHROME, "Ust%27-Kamenogorsk", null), "Chrome · macOS · Ust'-Kamenogorsk");
});

test("устройство: пустые данные", () => {
  assert.equal(describeDevice(null, null, null), "неизвестное устройство");
});

test("токен входа: только 32 hex-символа", () => {
  assert.equal(isLoginToken("0123456789abcdef0123456789abcdef"), true);
  assert.equal(isLoginToken("0123456789ABCDEF0123456789abcdef"), false);
  assert.equal(isLoginToken("short"), false);
  assert.equal(isLoginToken("'; drop table--0123456789abcdef01"), false);
});
