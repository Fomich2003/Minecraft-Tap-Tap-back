const ENDPOINT = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t";
const OFFICIAL_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const MAX_BATCH_CHARS = 4500;
const MAX_BATCH_LINES = 150;
const MAX_ATTEMPTS = 4;
// Безкоштовний перекладач швидко відповідає 429, тому запити йдуть рідко й по одному
const REQUEST_INTERVAL_MS = 8000;
const RATE_LIMIT_PAUSE_MS = 5 * 60 * 1000;
const OFFICIAL_INTERVAL_MS = 150;

// Google закрив доступ цій IP: чекати немає сенсу, збірка має йти далі з тим, що вже перекладено
export class TranslatorBlockedError extends Error {}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Плейсхолдери ховаються в токени, які перекладач не чіпає
const protect = text => {
    const names = [];
    const safe = text.replace(/\{(\w+)\}/g, (match, name) => {
        names.push(name);
        return `[[${names.length - 1}]]`;
    });
    return { safe, names };
};

function restore(text, names) {
    const used = new Set();
    const result = text
        .replace(/[[［【]\s*[[［【]\s*(\p{Nd}+)\s*[\]］】]\s*[\]］】]/gu, (match, digits) => {
            const index = [...digits].reduce((value, digit) => value * 10 + (digit.codePointAt(0) & 0xf), 0);
            used.add(index);
            return names[index] === undefined ? match : `{${names[index]}}`;
        })
        .trim();
    return used.size === names.length && !/\[\[|\]\]/.test(result) ? result : null;
}

function createBatches(texts) {
    const batches = [];
    let batch = [];
    let size = 0;
    for (const text of texts) {
        if (batch.length && (size + text.length > MAX_BATCH_CHARS || batch.length >= MAX_BATCH_LINES)) {
            batches.push(batch);
            batch = [];
            size = 0;
        }
        batch.push(text);
        size += text.length + 1;
    }
    if (batch.length) batches.push(batch);
    return batches;
}

// Офіційний Cloud Translation API: потребує ключа, зате не має обмежень безкоштовної адреси
async function requestOfficial(apiKey, target, text) {
    const response = await fetch(`${OFFICIAL_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: "en", target, format: "text" }),
    });
    if (!response.ok) throw new Error(`Translator ${target}: ${response.status}`);
    const data = await response.json();
    return data.data.translations[0].translatedText;
}

export function createTranslator({ log = () => {}, apiKey = null } = {}) {
    let nextRequestAt = 0;
    let requests = 0;

    async function request(target, text) {
        if (apiKey) {
            const wait = nextRequestAt - Date.now();
            if (wait > 0) await delay(wait);
            nextRequestAt = Date.now() + OFFICIAL_INTERVAL_MS;
            requests += 1;
            return await requestOfficial(apiKey, target, text);
        }

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            const wait = nextRequestAt - Date.now();
            if (wait > 0) await delay(wait);
            nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
            requests += 1;
            try {
                const response = await fetch(`${ENDPOINT}&tl=${encodeURIComponent(target)}`, {
                    method: "POST",
                    redirect: "manual",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: new URLSearchParams({ q: text }),
                });
                // Блокування приходить редиректом на сторінку google.com/sorry
                if (response.status >= 300 && response.status < 400) throw new TranslatorBlockedError("Google заблокував запити з цієї IP");
                if (response.status === 429 || response.status >= 500) {
                    nextRequestAt = Date.now() + RATE_LIMIT_PAUSE_MS * (attempt + 1);
                    log(`Перекладач відповів ${response.status}, пауза ${attempt + 1}`);
                    continue;
                }
                if (!response.ok) throw new Error(`Translator ${target}: ${response.status}`);
                const data = await response.json();
                return (data[0] ?? []).map(segment => segment[0] ?? "").join("");
            } catch (error) {
                if (error instanceof TranslatorBlockedError || attempt === MAX_ATTEMPTS - 1) throw error;
                await delay(1000 * (attempt + 1));
            }
        }
        throw new TranslatorBlockedError("Google не прибирає обмеження запитів");
    }

    // Рядки йдуть пачками через перенос. Якщо перекладач склеїв рядки, пачка ділиться навпіл
    async function translateBatch(target, batch, result) {
        const prepared = batch.map(protect);
        const lines = (await request(target, prepared.map(entry => entry.safe).join("\n"))).split("\n");

        if (lines.length === batch.length) {
            batch.forEach((text, index) => {
                const translated = restore(lines[index], prepared[index].names);
                if (translated) result.set(text, translated);
            });
            const lost = batch.filter(text => !result.has(text));
            if (batch.length > 1 && lost.length) await translateBatch(target, lost, result);
            return;
        }
        if (batch.length === 1) return;
        const middle = Math.ceil(batch.length / 2);
        await translateBatch(target, batch.slice(0, middle), result);
        await translateBatch(target, batch.slice(middle), result);
    }

    // Повертає все, що встигло перекластись: решту наступний запуск візьме з того самого місця
    async function translate(target, texts, onProgress) {
        const result = new Map();
        for (const batch of createBatches(texts)) {
            await translateBatch(target, batch, result);
            await onProgress(result);
        }
        return result;
    }

    return { translate, requests: () => requests };
}
