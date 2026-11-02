import {
    CARDS, cardBySlug, cardLevel, COLLECTION_BONUS_PER_CARD, deckBonus, deckCards, deckSlots, MAX_COPIES, MAX_DECK_SLOTS, nextLevelCopies,
    overflowXp, ownedCopies, resonanceOf, suitBonusOf,
} from "../data/cards.js";
import { LOCATIONS } from "../data/locations.js";
import { mobBySlug } from "../data/mobs.js";
import User from "../repositories/User.repository.js";
import catalogService from "./catalog.service.js";

const fail = (status, message) => ({ success: false, status, message });

const DEPTH_SLOTS = LOCATIONS.filter(location => location.level > 0).map(location => location.level);

// Епсилон рятує від 8,2499…% замість 8,25% після складання часток
const percent = fraction => Math.round(fraction * 1000 + 1e-6) / 10;

const hasMob = (user, slug) => mobBySlug.get(slug)?.price === 0 || (user.mobs ?? []).includes(slug);

// Невідкрита карта показує, що дасть на першому рівні: так видно, заради чого її шукати
function describeCard(card, user, names) {
    const copies = ownedCopies(user, card.slug);
    const shown = Math.max(1, copies);
    return {
        slug: card.slug, kind: card.kind, suit: card.suit, rarity: card.rarity, location: card.location, icon: card.icon,
        name: card.name ?? names.get(card.slug) ?? card.slug,
        copies, level: cardLevel(copies), next: nextLevelCopies(copies), max: MAX_COPIES,
        resonance: percent(resonanceOf(card, shown)), suitBonus: percent(suitBonusOf(card, shown)),
    };
}

function describeDeck(user) {
    const bonus = deckBonus(user);
    const slots = deckSlots(user.xpTotal);
    return {
        deck: deckCards(user).map(card => card.slug),
        slots,
        // Рівень досвіду, на якому відкривається кожен слот: базові з початку, решта з новою локацією
        slotLevels: [...Array(MAX_DECK_SLOTS - DEPTH_SLOTS.length).fill(0), ...DEPTH_SLOTS],
        bonus: {
            coins: percent(bonus.coins), blockDrop: percent(bonus.blockDrop), mobDrop: percent(bonus.mobDrop), xp: percent(bonus.xp),
            collection: percent(bonus.collected * COLLECTION_BONUS_PER_CARD),
        },
        combos: bonus.combos.map(combo => ({ ...combo, coins: combo.coins && percent(combo.coins), drop: combo.drop && percent(combo.drop) })),
        collected: bonus.collected,
        total: CARDS.length,
    };
}

class CardService {
    async list(user) {
        const { itemBySlug } = await catalogService.get();
        const names = new Map(CARDS.filter(card => card.kind === "block").map(card => [card.slug, itemBySlug.get(card.slug)?.name]));
        return { success: true, status: 200, cards: CARDS.map(card => describeCard(card, user, names)), ...describeDeck(user) };
    }

    // Колода задається цілком: так клієнт може і додати, і прибрати, і переставити карту одним запитом
    async setDeck(user, slugs) {
        if (!Array.isArray(slugs) || slugs.some(slug => typeof slug !== "string")) return fail(400, "Некоректна колода");
        const unique = [...new Set(slugs)];
        if (unique.length !== slugs.length) return fail(400, "Некоректна колода");
        if (unique.length > deckSlots(user.xpTotal)) return fail(400, "Колода заповнена");
        if (unique.some(slug => !cardBySlug.has(slug) || ownedCopies(user, slug) < 1)) return fail(400, "Цієї карти ще немає");

        const updated = await User.setDeck(user._id, unique);
        return await this.list(updated);
    }

    // Видає одну копію. Карта на максимумі перетворюється на досвід, тому дубль ніколи не марний
    async grant(userId, slug) {
        const card = cardBySlug.get(slug);
        if (!card) return null;
        const { itemBySlug } = await catalogService.get();
        const base = {
            slug, kind: card.kind, rarity: card.rarity, suit: card.suit, icon: card.icon, location: card.location,
            name: card.name ?? itemBySlug.get(slug)?.name ?? slug,
        };
        const updated = await User.addCard(userId, slug, MAX_COPIES);
        if (!updated) {
            const xp = overflowXp(slug);
            await User.addXp(userId, xp);
            return { ...base, copies: MAX_COPIES, level: cardLevel(MAX_COPIES), next: null, xp, isNew: false, levelUp: false };
        }
        const copies = ownedCopies(updated, slug);
        return {
            ...base, copies, level: cardLevel(copies), next: nextLevelCopies(copies), xp: 0,
            isNew: copies === 1, levelUp: copies > 1 && cardLevel(copies) > cardLevel(copies - 1),
        };
    }

    // Щоденна нагорода приносить карту одного з джерел, які вже є в гравця
    async grantDaily(user) {
        const sources = [
            ...(user.tapBlocks ?? []).map(block => block.slug),
            ...CARDS.filter(card => card.kind === "mob" && !mobBySlug.get(card.slug).boss && hasMob(user, card.slug)).map(card => card.slug),
        ].filter(slug => cardBySlug.has(slug));
        if (!sources.length) return null;
        return await this.grant(user._id, sources[Math.floor(Math.random() * sources.length)]);
    }
}

export default new CardService();
