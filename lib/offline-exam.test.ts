import assert from "node:assert/strict";
import test from "node:test";
import { decryptOfflinePassword, encryptOfflinePassword, localExamUrl, parseOfflineCredentials } from "./offline-exam";

test("credential CSV keeps each student's password with the correct phone", () => {
  const rows = parseOfflineCredentials('Топ,Аты-жөні,Телефон,Құпия сөз\nM-1,"Әли, Нұр",+7 701 123 45 67,ABC123\nM-2,Айша,87021234567,DEF456\n');
  assert.deepEqual(rows.map(({ name, phoneDigits, password }) => ({ name, phoneDigits, password })), [
    { name: "Әли, Нұр", phoneDigits: "7011234567", password: "ABC123" },
    { name: "Айша", phoneDigits: "7021234567", password: "DEF456" },
  ]);
  assert.throws(() => parseOfflineCredentials('Аты-жөні,Телефон,Құпия сөз\nА,+77011234567,ABC123\nБ,87011234567,DEF456\n'), /қайталанды/);
});

test("local exam URL accepts the centre address only", () => {
  assert.equal(localExamUrl("http://192.168.8.125:4173/"), "http://192.168.8.125:4173");
  assert.throws(() => localExamUrl("https://example.com/"));
  assert.throws(() => localExamUrl("http://192.168.8.125:4173/?password=secret"));
});

test("password encryption round trips and detects changes", () => {
  const key = "a-long-test-secret-at-least-twenty-characters";
  const encrypted = encryptOfflinePassword("ABC123", key);
  assert.equal(decryptOfflinePassword(encrypted, key), "ABC123");
  assert.notEqual(encrypted, encryptOfflinePassword("ABC123", key));
  assert.throws(() => decryptOfflinePassword(encrypted, "a-different-long-secret-over-twenty-characters"));
});
