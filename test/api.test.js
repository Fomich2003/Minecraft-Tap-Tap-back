// Наскрізні перевірки API на окремій базі. Запуск:
//   TEST_DB_URL=mongodb://127.0.0.1:27831/taptap_test npm test
// База має бути локальною і вже заповненою каталогом (npm run import:catalog з тим самим DB_URL).
// Тест видаляє лише гравців, яких сам створив, але на спільну базу (Atlas) не запускається взагалі.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { signInitData, TEST_TOKEN } from "./helpers/telegram.js";

const DB_URL = process.env.TEST_DB_URL;
const LOCAL_DB = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;

process.env.BOT_TOKEN = TEST_TOKEN;
process.env.BOT_POLLING = "off";
process.env.MODE = "production";

const skip = !DB_URL ? "TEST_DB_URL не задано" : !LOCAL_DB.test(DB_URL) ? "TEST_DB_URL має вести на локальну базу" : false;

describe("API", { skip }, () => {
    let mongoose, User, Inventory, Item, server, base, critical, SERVER_CONF, playerLimiter, appRef;
    const TEST_IDS = [910000001, 910000002, 910000003, 910000004];

    const initData = (id, extra = {}) => signInitData(TEST_TOKEN, { user: { id, first_name: `Tester${id % 10}`, username: `tester_${id}` }, ...extra });

    async function call(path, body = {}, { id = TEST_IDS[0], headers = {}, raw } = {}) {
        const payload = raw ?? JSON.stringify({ telegramData: id ? initData(id) : undefined, ...body });
        const response = await fetch(`${base}/api${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: payload });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { text }; }
        return { status: response.status, data };
    }

    const userOf = id => User.findOne({ telegramId: id }).lean();

    before(async () => {
        mongoose = (await import("mongoose")).default;
        ({ default: User } = await import("../src/models/User.model.js"));
        ({ default: Inventory } = await import("../src/models/Inventory.model.js"));
        ({ default: Item } = await import("../src/models/Item.model.js"));
        critical = await import("../src/data/critical.js");
        ({ SERVER_CONF } = await import("../src/config/server.config.js"));
        ({ playerLimiter } = await import("../src/middlewares/verify.middleware.js"));
        const { createApp } = await import("../src/app.js");

        await mongoose.connect(DB_URL);
        assert.ok(await Item.exists({ isFirst: true }), "У тестовій базі немає каталогу: спершу import:catalog");
        await cleanup();

        appRef = createApp();
        server = appRef.listen(0, "127.0.0.1");
        await new Promise(resolve => server.once("listening", resolve));
        base = `http://127.0.0.1:${server.address().port}`;
    });

    async function cleanup() {
        const users = await User.find({ telegramId: { $in: TEST_IDS } }, "_id").lean();
        await Inventory.deleteMany({ userId: { $in: users.map(user => user._id) } });
        await User.deleteMany({ telegramId: { $in: TEST_IDS } });
    }

    after(async () => {
        await cleanup();
        server?.close();
        playerLimiter?.stop();
        appRef?.ipLimiter.stop();
        await mongoose?.disconnect();
    });

    test("без підпису Telegram — 401", async () => {
        const { status } = await call("/user/profile", {}, { id: null });
        assert.equal(status, 401);
    });

    test("підроблений підпис — 401, профіль не створюється", async () => {
        const forged = signInitData("111:wrong", { user: { id: TEST_IDS[3] } });
        const { status } = await call("/user/profile", {}, { raw: JSON.stringify({ telegramData: forged }) });
        assert.equal(status, 401);
        assert.equal(await userOf(TEST_IDS[3]), null);
    });

    test("тестовий вхід режиму development не працює через тунель", async () => {
        SERVER_CONF.mode = "development";
        try {
            const { status } = await call("/user/profile", {}, { id: null, headers: { "x-forwarded-for": "8.8.8.8" } });
            assert.equal(status, 401);
        } finally {
            SERVER_CONF.mode = "production";
        }
    });

    test("перший вхід створює профіль та інвентар", async () => {
        const { status, data } = await call("/user/profile");
        assert.equal(status, 200);
        assert.equal(data.user.telegramId, TEST_IDS[0]);
        assert.equal(data.user.balance, 0);
        assert.ok(data.inventory);
    });

    test("баланс з клієнта ігнорується", async () => {
        await call("/user/profile", { balance: 999999, user: { balance: 999999 } });
        assert.equal((await userOf(TEST_IDS[0])).balance, 0);
    });

    test("тапи: сервер рахує монети, ліміт швидкості і крити", async () => {
        const first = await call("/block/get-first");
        assert.equal(first.status, 200);
        const slug = first.data.block.slug;

        const before = await userOf(TEST_IDS[0]);
        const { status, data } = await call("/block/tap", { slug, count: 7 });
        assert.equal(status, 200);
        assert.equal(data.acceptedTaps, 7);
        assert.equal(data.user.balance, before.balance + 7);
        assert.equal(data.user.tapCount, (before.tapCount ?? 0) + 7);

        let expectedCrits = 0;
        for (let index = before.tapCount ?? 0; index < (before.tapCount ?? 0) + 7; index += 1) {
            if (critical.isCritical(String(before._id), index)) expectedCrits += 1;
        }
        assert.equal(data.crits, expectedCrits);

        // Запас ударів обмежений: 100 000 тапів одним запитом не пройдуть
        const flood = await call("/block/tap", { slug, count: 100000 });
        assert.equal(flood.status, 200);
        assert.ok(flood.data.acceptedTaps <= 120, `прийнято ${flood.data.acceptedTaps}`);
    });

    test("моб: удари через той самий ліміт, крити збігаються з передбаченням", async () => {
        const before = await userOf(TEST_IDS[0]);
        const { status, data } = await call("/mob/hit", { slug: "chicken", count: 6 });
        assert.equal(status, 200);
        assert.ok(data.acceptedTaps >= 1 && data.acceptedTaps <= 6);
        let expected = 0;
        for (let index = before.tapCount; index < before.tapCount + data.acceptedTaps; index += 1) {
            if (critical.isCritical(String(before._id), index)) expected += 1;
        }
        assert.equal(data.crits, expected);
        const locked = await call("/mob/hit", { slug: "shulker", count: 1 });
        assert.equal(locked.status, 403);
    });

    test("некоректна кількість тапів — 400", async () => {
        for (const count of [-5, 0, 1.5, "abc", null, [3], 2 ** 60]) {
            const { status } = await call("/block/tap", { slug: "oak_log", count });
            assert.equal(status, 400, `count=${JSON.stringify(count)}`);
        }
    });

    test("тап по чужому, некупленому блоку — 400", async () => {
        const { status } = await call("/block/tap", { slug: "diamond_ore", count: 1 });
        assert.equal(status, 400);
    });

    test("оператор Mongo замість slug не обходить рівень локації", async () => {
        await User.updateOne({ telegramId: TEST_IDS[0] }, { $set: { balance: 10_000_000 } });
        const injected = await call("/block/buy", { slug: { $in: ["diamond_ore"] } });
        assert.equal(injected.status, 400);
        const user = await User.findOne({ telegramId: TEST_IDS[0] }).populate("tapBlocks", "slug").lean();
        assert.equal(user.balance, 10_000_000);
        assert.ok(!user.tapBlocks.some(block => block.slug === "diamond_ore"));

        const honest = await call("/block/buy", { slug: "diamond_ore" });
        assert.equal(honest.status, 403);
    });

    test("паралельні покупки не заводять баланс у мінус", async () => {
        const block = await Item.findOne({ canTap: true, isFirst: { $ne: true }, slug: "pumpkin" }).lean();
        assert.ok(block, "у каталозі немає гарбуза");
        await User.updateOne({ telegramId: TEST_IDS[0] }, { $set: { balance: 400 } });
        const results = await Promise.all(Array.from({ length: 6 }, () => call("/block/buy", { slug: block.slug })));
        assert.equal(results.filter(result => result.status === 200).length, 1);
        const user = await userOf(TEST_IDS[0]);
        assert.ok(user.balance >= 0);
    });

    test("щоденну нагороду не забрати двічі паралельними запитами", async () => {
        await call("/user/profile", {}, { id: TEST_IDS[1] });
        const results = await Promise.all(Array.from({ length: 5 }, () => call("/user/claim-award", {}, { id: TEST_IDS[1] })));
        assert.equal(results.filter(result => result.status === 200).length, 1);
        assert.equal((await userOf(TEST_IDS[1])).balance, 500);
    });

    test("квест не видається двічі", async () => {
        const quests = await call("/quest/list", {}, { id: TEST_IDS[1] });
        assert.equal(quests.status, 200);
        const claims = await Promise.all(Array.from({ length: 4 }, () => call("/quest/claim", { id: "awards_7" }, { id: TEST_IDS[1] })));
        assert.ok(claims.every(result => result.status === 400), "квест ще не виконано");
    });

    test("тижневі квести: три на тиждень, тапи рахуються, нагорода лише одна", async () => {
        const { currentWeek } = await import("../src/services/quest.service.js");
        const list = await call("/quest/list");
        assert.equal(list.status, 200);
        assert.equal(list.data.weekly.length, 3);
        assert.ok(new Date(list.data.weeklyResetsAt).getTime() > Date.now());

        const user = await userOf(TEST_IDS[0]);
        assert.equal(user.weekly.week, currentWeek());
        const quest = list.data.weekly[0];

        // Ще не виконано
        const early = await call("/quest/claim", { id: quest.id });
        assert.equal(early.status, 400);

        await User.updateOne({ telegramId: TEST_IDS[0] }, { $set: { [`weekly.progress.${quest.metric}`]: quest.target } });
        const balance = (await userOf(TEST_IDS[0])).balance;
        const claims = await Promise.all(Array.from({ length: 4 }, () => call("/quest/claim", { id: quest.id })));
        assert.equal(claims.filter(result => result.status === 200).length, 1);
        const won = claims.find(result => result.status === 200).data;
        assert.equal((await userOf(TEST_IDS[0])).balance, balance + won.reward.coins);
        assert.ok(won.weekly.find(entry => entry.id === quest.id).claimed);
    });

    test("тижневий набір минулого тижня не зараховується в новий", async () => {
        await User.updateOne({ telegramId: TEST_IDS[0] }, { $set: { "weekly.week": "2000-01-03", "weekly.progress": { taps: 999999 } } });
        const slug = (await call("/block/get-userblocks")).data.blocks[0].slug;
        const tap = await call("/block/tap", { slug, count: 3 });
        assert.equal(tap.status, 200);
        const user = await userOf(TEST_IDS[0]);
        assert.notEqual(user.weekly.week, "2000-01-03");
        assert.equal(user.weekly.progress.taps, 3);
    });

    test("квест з об'єктом замість id — 404", async () => {
        const { status } = await call("/quest/claim", { id: ["taps_100"] });
        assert.equal(status, 404);
    });

    test("продаж чужого або вигаданого стака не дає монет", async () => {
        const before = (await userOf(TEST_IDS[1])).balance;
        const { status } = await call("/inventory/sell", { stackId: "65f0c0ffee0000000000abcd", quantity: 64 }, { id: TEST_IDS[1] });
        assert.equal(status, 400);
        assert.equal((await userOf(TEST_IDS[1])).balance, before);
    });

    test("таблиця лідерів не показує Telegram id", async () => {
        await User.updateOne({ telegramId: TEST_IDS[0] }, { $set: { balance: 1234 } });
        const { status, data } = await call("/user/leaderboard", { metric: "coins" });
        assert.equal(status, 200);
        assert.ok(!JSON.stringify(data).includes(String(TEST_IDS[0])));
        assert.ok(data.players.some(player => player.me));
        const bad = await call("/user/leaderboard", { metric: { $ne: 1 } });
        assert.equal(bad.status, 400);
        const unknown = await call("/user/leaderboard", { metric: "telegramId" });
        assert.equal(unknown.status, 400);
    });

    test("зламаний JSON — охайна відповідь 400 без стеку", async () => {
        const { status, data } = await call("/user/profile", {}, { raw: "{\"telegramData\": " });
        assert.equal(status, 400);
        assert.equal(data.success, false);
        assert.ok(!data.text);
    });

    test("ліміт запитів гравця — 429", async () => {
        playerLimiter.reset();
        let limited = 0;
        for (let index = 0; index < 250 && !limited; index += 1) {
            const { status } = await call("/quest/list", {}, { id: TEST_IDS[2] });
            if (status === 429) limited = index;
        }
        assert.equal(limited, 240);
        playerLimiter.reset();
    });
});
