import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { localDigits } from "./phone";

export type OfflineCredential = { phoneDigits: string; password: string; name: string; group: string };

function csvRows(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("CSV тырнақшасы жабылмаған");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseOfflineCredentials(source: string): OfflineCredential[] {
  const [header, ...body] = csvRows(source);
  if (!header) throw new Error("CSV файлы бос");
  const keys = header.map((value) => value.toLocaleLowerCase("kk-KZ").replace(/\s+/g, " "));
  const phoneIndex = keys.findIndex((value) => ["телефон", "phone"].includes(value));
  const passwordIndex = keys.findIndex((value) => ["құпия сөз", "password"].includes(value));
  const nameIndex = keys.findIndex((value) => ["аты-жөні", "name"].includes(value));
  const groupIndex = keys.findIndex((value) => ["топ", "group"].includes(value));
  if (phoneIndex < 0 || passwordIndex < 0 || nameIndex < 0) throw new Error("CSV ішінде Аты-жөні, Телефон және Құпия сөз бағандары болуы керек");
  if (body.length === 0 || body.length > 5000) throw new Error("CSV ішінде 1–5000 оқушы болуы керек");
  const seen = new Set<string>();
  return body.map((row, index) => {
    if (row.length !== header.length) throw new Error(`${index + 2}-жолда баған саны қате`);
    const phoneDigits = localDigits(row[phoneIndex].replace(/^'/, ""));
    const password = row[passwordIndex];
    if (!phoneDigits || password.length < 6 || password.length > 128 || /[\r\n]/.test(password)) {
      throw new Error(`${index + 2}-жолда телефон немесе құпия сөз қате`);
    }
    if (seen.has(phoneDigits)) throw new Error(`${index + 2}-жолда телефон қайталанды`);
    seen.add(phoneDigits);
    if (!row[nameIndex]) throw new Error(`${index + 2}-жолда аты-жөні бос`);
    return { phoneDigits, password, name: row[nameIndex], group: groupIndex >= 0 ? row[groupIndex] : "" };
  });
}

export function localExamUrl(raw: string): string {
  const url = new URL(raw.trim());
  const host = url.hostname;
  const privateIpv4 = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  if (url.protocol !== "http:" || !privateIpv4 || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Офлайн тест сілтемесі жергілікті http://IP:порт мекенжайы болуы керек");
  }
  return url.origin;
}

function secretKey(secret: string): Buffer {
  if (secret.length < 20) throw new Error("AUTH_SECRET орнатылмаған");
  return createHash("sha256").update("matacademy-offline-test-access-v1\0").update(secret).digest();
}

export function encryptOfflinePassword(password: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptOfflinePassword(value: string, secret: string): string {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error("Офлайн тест дерегі қате");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
