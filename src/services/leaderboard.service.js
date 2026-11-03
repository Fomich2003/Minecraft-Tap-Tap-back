import { levelFromXp } from "../data/experience.js";
import { MOBS } from "../data/mobs.js";
import User from "../repositories/User.repository.js";

const LIMIT = 50;
const BOSS_SLUGS = MOBS.filter(mob => mob.boss).map(mob => mob.slug);

const counter = path => ({ $ifNull: [`$${path}`, 0] });
const BOSS_KILLS = { $add: BOSS_SLUGS.map(slug => counter(`mobKills.${slug}`)) };

// Рівень досвіду залежить лише від xpTotal, тому досвід точніше впорядковує гравців одного рівня
const SCORES = { level: counter("xpTotal"), coins: counter("balance"), bosses: BOSS_KILLS };
// Таблиці за простим полем читаються індексом, а не переглядом усіх гравців
const FIELDS = { level: "xpTotal", coins: "balance" };

// Telegram id сюди не потрапляє: таблицю бачать усі гравці
const describe = (row, rank) => ({
    rank,
    name: row.firstName || row.username || null,
    level: levelFromXp(row.xpTotal),
    coins: row.balance,
    bosses: row.bosses,
});

// Однаковий результат дає однакове місце: інакше порядок рівних гравців вирішувала б дата реєстрації
function rankRows(rows, userId) {
    let rank = 0;
    return rows.map((row, index) => {
        if (row.score !== rows[index - 1]?.score) rank = index + 1;
        return { ...describe(row, rank), me: row._id.equals(userId) };
    });
}

class LeaderboardService {
    async top(user, metric) {
        if (!Object.hasOwn(SCORES, metric)) return { success: false, status: 400, message: "Некоректна таблиця" };
        const score = SCORES[metric];
        const field = FIELDS[metric] ?? null;
        const filter = field ? { [field]: { $gt: 0 } } : { $expr: { $gt: [score, 0] } };
        const [rows, [own]] = await Promise.all([
            User.leaderboardRows(filter, score, BOSS_KILLS, LIMIT, field),
            User.leaderboardRows({ _id: user._id }, score, BOSS_KILLS, 1),
        ]);
        const rank = own.score > 0 ? await User.countAbove(score, own.score, field) + 1 : null;
        return { success: true, status: 200, metric, players: rankRows(rows, user._id), me: { ...describe(own, rank), me: true } };
    }
}

export default new LeaderboardService();
