import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { signInitData, TEST_TOKEN } from "./helpers/telegram.js";

process.env.BOT_TOKEN = TEST_TOKEN;

const { default: verifyTelegram } = await import("../src/utils/crypto.js");
const { findUnsafeKey, createRateLimiter } = await import("../src/middlewares/security.middleware.js");
const { isLocalRequest } = await import("../src/middlewares/verify.middleware.js");
const { originAllowed } = await import("../src/config/cors.config.js");
const { publicMessage, GENERIC_ERROR } = await import("../src/utils/http.js");
const critical = await import("../src/data/critical.js");
const { isSlug } = await import("../src/controllers/block.controller.js");

const USER = { id: 777000111, first_name: "Steve", username: "steve" };

describe("Telegram initData", () => {
    test("приймає дані, підписані офіційним алгоритмом", () => {
        const result = verifyTelegram(signInitData(TEST_TOKEN, { user: USER }));
        assert.equal(result?.user.id, USER.id);
    });

    test("відхиляє підпис іншим токеном", () => {
        assert.equal(verifyTelegram(signInitData("999:other", { user: USER })), null);
    });

    test("відхиляє підмінений id гравця", () => {
        const signed = signInitData(TEST_TOKEN, { user: USER });
        const forged = signed.replace(encodeURIComponent(`"id":${USER.id}`), encodeURIComponent(`"id":1`));
        assert.notEqual(forged, signed);
        assert.equal(verifyTelegram(forged), null);
    });

    test("відхиляє прострочені дані", () => {
        const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
        assert.equal(verifyTelegram(signInitData(TEST_TOKEN, { user: USER, authDate: twoDaysAgo })), null);
    });

    test("відхиляє сміття замість initData", () => {
        assert.equal(verifyTelegram("test"), null);
        assert.equal(verifyTelegram(""), null);
    });
});

describe("Вхідні дані", () => {
    test("знаходить оператори Mongo на будь-якій глибині", () => {
        assert.equal(findUnsafeKey({ slug: { $ne: null } }), "$ne");
        assert.equal(findUnsafeKey({ slots: { a: [{ $gt: "" }] } }), "$gt");
        assert.equal(findUnsafeKey(JSON.parse('{"__proto__": {"admin": true}}')), "__proto__");
    });

    test("пропускає звичайні тіла запитів", () => {
        assert.equal(findUnsafeKey({ slug: "stone", count: 5, slots: { input: "abc" }, deck: ["stone"] }), null);
        assert.equal(findUnsafeKey(undefined), null);
    });

    test("slug блока лише рядок каталогу", () => {
        assert.equal(isSlug("deepslate_diamond_ore"), true);
        assert.equal(isSlug({ $ne: null }), false);
        assert.equal(isSlug("stone\"; drop"), false);
        assert.equal(isSlug(""), false);
    });
});

describe("Ліміт запитів", () => {
    test("пропускає max запитів і відповідає 429 далі", () => {
        const limiter = createRateLimiter({ windowMs: 60000, max: 3, keyOf: req => req.key });
        const statuses = [];
        const res = { set() { }, status(code) { statuses.push(code); return { json() { } }; } };
        let passed = 0;
        for (let index = 0; index < 5; index += 1) limiter({ key: "a" }, res, () => { passed += 1; });
        limiter({ key: "b" }, res, () => { passed += 1; });
        limiter.stop();
        assert.equal(passed, 4);
        assert.deepEqual(statuses, [429, 429]);
    });
});

describe("Тестовий вхід без підпису", () => {
    const request = (headers, address = "127.0.0.1") => ({ headers, socket: { remoteAddress: address } });

    test("дозволений лише прямому локальному запиту", () => {
        assert.equal(isLocalRequest(request({ host: "localhost:6788" })), true);
        assert.equal(isLocalRequest(request({ host: "127.0.0.1:6788", "ngrok-skip-browser-warning": "1" })), true);
    });

    test("заборонений через тунель ngrok навіть з localhost", () => {
        assert.equal(isLocalRequest(request({ host: "stump-facial-tannery.ngrok-free.dev", "x-forwarded-for": "8.8.8.8" })), false);
        assert.equal(isLocalRequest(request({ host: "stump-facial-tannery.ngrok-free.dev" })), false);
        assert.equal(isLocalRequest(request({ host: "localhost", "x-forwarded-proto": "https" })), false);
        assert.equal(isLocalRequest(request({ host: "localhost", "cf-connecting-ip": "1.1.1.1" })), false);
    });

    test("заборонений для запиту з мережі", () => {
        assert.equal(isLocalRequest(request({ host: "localhost" }, "192.168.1.5")), false);
    });
});

describe("CORS", () => {
    test("дозволяє сайт гри, локальну розробку і запити без Origin", () => {
        assert.equal(originAllowed("https://tap-tap.fomka.online"), true);
        assert.equal(originAllowed("http://localhost:5173"), true);
        assert.equal(originAllowed(undefined), true);
    });

    test("не дозволяє сторонні сайти, якщо їх не додано в .env", () => {
        assert.equal(originAllowed("https://evil.example"), false);
        assert.equal(originAllowed("https://tap-tap.fomka.online.evil.example"), false);
        assert.equal(originAllowed("https://evil.example", ["https://evil.example"]), true);
    });
});

describe("Помилки сервера", () => {
    test("технічний текст не потрапляє до гравця", () => {
        assert.equal(publicMessage(new Error("E11000 duplicate key error collection: users")), GENERIC_ERROR);
        assert.equal(publicMessage(new Error("Інвентар зайнятий, спробуй ще раз")), "Інвентар зайнятий, спробуй ще раз");
        assert.equal(publicMessage(undefined), GENERIC_ERROR);
    });
});

describe("Критичний удар", () => {
    test("результат залежить лише від гравця й номера тапу", () => {
        assert.equal(critical.isCritical("abc", 5), critical.isCritical("abc", 5));
    });

    test("частота близька до заявленої", () => {
        let crits = 0;
        const total = 20000;
        for (let index = 0; index < total; index += 1) if (critical.isCritical("65f0c0ffee0000000000abcd", index)) crits += 1;
        assert.ok(Math.abs(crits / total - critical.CRIT_CHANCE) < 0.01, `частота ${crits / total}`);
    });

    test("крит не ламає більше одного блока і завжди сильніший за звичайний удар", () => {
        assert.equal(critical.critPower(1, 10), 2);
        assert.equal(critical.critPower(6, 8), 8);
        assert.equal(critical.critPower(4, 4), 4);
    });

    test("сила пачки дорівнює сумі окремих ударів", () => {
        const { total, crits } = critical.batchPower("user", 100, 50, 3, 20);
        let expected = 0;
        for (let index = 100; index < 150; index += 1) expected += critical.isCritical("user", index) ? critical.critPower(3, 20) : 3;
        assert.equal(total, expected);
        assert.ok(crits >= 0 && crits <= 50);
    });

    test("клієнт рахує крити так само, як сервер", async () => {
        const clientFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/src/utils/critical.js");
        if (!existsSync(clientFile)) return;
        const client = await import(pathToFileURL(clientFile).href);
        for (let index = 0; index < 2000; index += 1) {
            assert.equal(client.isCritical("65f0c0ffee0000000000abcd", index), critical.isCritical("65f0c0ffee0000000000abcd", index));
        }
        assert.equal(client.critPower(5, 30), critical.critPower(5, 30));
        assert.equal(client.CRIT_CHANCE, critical.CRIT_CHANCE);
    });
});

describe("Щоденна скриня", () => {
    test("кожен предмет лише одним записом", async () => {
        const { rollDailyLoot } = await import("../src/data/daily-loot.js");
        for (let attempt = 0; attempt < 300; attempt += 1) {
            const loot = rollDailyLoot(60);
            assert.equal(new Set(loot.map(entry => entry.slug)).size, loot.length);
            assert.ok(loot.every(entry => Number.isSafeInteger(entry.quantity) && entry.quantity > 0));
        }
    });
});

describe("Експедиції", async () => {
    const { expeditionPlan, rollExpedition, MAX_MAP_SCALE } = await import("../src/data/expeditions.js");

    test("масштаб подовжує похід, але здобич за годину та сама", () => {
        const small = expeditionPlan("caves", 0);
        const large = expeditionPlan("caves", MAX_MAP_SCALE);
        assert.equal(large.ms, small.ms * (MAX_MAP_SCALE + 1));
        assert.equal(large.finds / large.ms, small.finds / small.ms);
        assert.equal(expeditionPlan("caves", 99).scale, MAX_MAP_SCALE);
        assert.equal(expeditionPlan("nowhere", 0), null);
    });

    test("здобич лише з предметів каталогу, без монет", () => {
        let seed = 7;
        const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const itemBySlug = new Map(["cobblestone", "rotten_flesh", "bone", "string", "diamond", "iron_ingot", "name_tag", "golden_apple", "arrow", "gunpowder"].map(slug => [slug, {}]));
        const loot = rollExpedition(expeditionPlan("caves", MAX_MAP_SCALE), { itemBySlug, dropFor: () => "cobblestone" }, random);
        assert.ok(loot.items.length > 0);
        assert.ok(loot.items.every(entry => itemBySlug.has(entry.slug) && entry.quantity > 0));
        assert.equal(loot.coins, undefined);
    });
});
