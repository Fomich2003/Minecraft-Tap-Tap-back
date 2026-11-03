// Критичний удар. Чи буде удар критичним, вирішує хеш id гравця і номера його тапу:
// результат однаковий на сервері й у клієнті, тож анімація збігається з нарахуванням,
// а сервер не довіряє жодному числу від клієнта. Копія цього файлу: client/src/utils/critical.js
export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.5;

// FNV-1a з фінальним перемішуванням murmur3: сусідні номери тапів дають незалежні результати
function hash32(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    return hash >>> 0;
}

export const critRoll = (userId, tapIndex) => hash32(`${userId}:${tapIndex}`) / 0x100000000;

export const isCritical = (userId, tapIndex) => critRoll(userId, tapIndex) < CRIT_CHANCE;

// Крит не ламає більше одного блока за удар, як і звичайний тап
export const critPower = (power, cap) => Math.min(Math.max(1, cap), Math.ceil(power * CRIT_MULTIPLIER));

// Сумарна сила пачки тапів, що починається з тапу startIndex
export function batchPower(userId, startIndex, taps, power, cap) {
    let total = 0;
    let crits = 0;
    for (let offset = 0; offset < taps; offset += 1) {
        if (isCritical(userId, startIndex + offset)) {
            total += critPower(power, cap);
            crits += 1;
        } else {
            total += power;
        }
    }
    return { total, crits };
}
