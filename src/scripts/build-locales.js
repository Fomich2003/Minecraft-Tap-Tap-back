import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openJar } from "../catalog/jar.js";
import { collectNameKeys } from "../catalog/locale-names.js";
import { downloadLanguage, prepareMinecraftData } from "../catalog/source.js";
import { createTranslator, TranslatorBlockedError } from "../catalog/translator.js";

// Генерує файли мов для клієнта: client/public/locales/<код>.json, languages.json і тексти бота.
// Назви предметів беруться з мов самого Minecraft, решта рядків перекладається машинно й кешується
// в server/temp/locale-cache, тому повторний запуск перекладає лише нове. Ручні переклади інтерфейсу
// лежать у server/src/data/ui-translations і важливіші за машинні. З GOOGLE_TRANSLATE_API_KEY у .env
// скрипт ходить в офіційний API. Без ключа Google може заблокувати IP: тоді збірка продовжиться без
// нових перекладів, а повторний запуск доробить решту.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const version = process.env.MINECRAFT_VERSION || "26.3";
const clientRoot = path.resolve(scriptDir, "../../../client");
const outputDir = path.join(clientRoot, "public/locales");
const cacheDir = path.resolve(scriptDir, "../../temp/locale-cache");
const manualDir = path.resolve(scriptDir, "../data/ui-translations");
const botTextsPath = path.resolve(scriptDir, "../data/bot-texts.json");
const translatorLanguagesPath = path.resolve(scriptDir, "../data/translator-languages.json");
const CONCURRENCY = 8;
const MAX_MISSING_UI_SHARE = 0.2;
const SOURCE_LANGUAGE = "uk";
const offline = process.argv.includes("--offline");
const withNames = process.argv.includes("--names");

// Коди перекладача, які не збігаються з кодом файлу мови Minecraft
const MINECRAFT_FILES = {
    en: "en_us", es: "es_es", de: "de_de", fr: "fr_fr", "fr-CA": "fr_ca", nl: "nl_nl", pt: "pt_br", "pt-PT": "pt_pt",
    iw: "he_il", tl: "fil_ph", "zh-CN": "zh_cn", "zh-TW": "zh_tw", yue: "zh_hk", sr: "sr_sp", be: "be_by", no: "no_no",
    "ms-Arab": "zlm_arab", cy: "cy_gb",
};

// Мови Minecraft, яких не знає перекладач: назви свої, інтерфейс беремо зі спорідненої мови
const MINECRAFT_ONLY = [
    ["ast", "ast_es", "Asturian", "es"], ["bar", "bar", "Bavarian", "de"], ["brb", "brb", "Brabantian", "nl"],
    ["enp", "enp", "Anglish", "en"], ["en-ws", "enws", "Shakespearean English", "en"], ["en-pt", "en_pt", "Pirate Speak", "en"],
    ["en-ud", "en_ud", "Upside Down English", "en"], ["esan", "esan", "Andalusian", "es"], ["vmf", "fra_de", "East Franconian", "de"],
    ["gallo", "go_fr", "Gallo", "fr"], ["got", "got_de", "Gothic", "de"], ["hal", "hal_ua", "Halychian", "uk"],
    ["hn", "hn_no", "High Norwegian", "no"], ["io", "io_en", "Ido", "en"], ["isv", "isv", "Interslavic", "ru"],
    ["jbo", "jbo_en", "Lojban", "en"], ["ksh", "ksh", "Kölsch", "de"], ["kw", "kw_gb", "Cornish", "en"],
    ["lol", "lol_us", "LOLCAT", "en"], ["lzh", "lzh", "Literary Chinese", "zh-TW"], ["nah", "nah", "Nahuatl", "es"],
    ["nds", "nds_de", "Low German", "de"], ["nn", "nn_no", "Norwegian Nynorsk", "no"], ["ovd", "ovd", "Elfdalian", "sv"],
    ["pls", "pls", "Popoloca", "es"], ["cab", "qcb_es", "Cantabrian", "es"], ["id-old", "qid", "Old Indonesian", "id"],
    ["qya", "qya_aa", "Quenya", "en"], ["ru-old", "rpr", "Pre-reform Russian", "ru"], ["rue", "ry_ua", "Rusyn", "uk"],
    ["sxu", "sxu", "Upper Saxon", "de"], ["tlh", "tlh_aa", "Klingon", "en"], ["tok", "tok", "Toki Pona", "en"],
    ["tzo", "tzo_mx", "Tzotzil", "es"], ["val", "val_es", "Valencian", "ca"], ["vp", "vp_vl", "Viossa", "en"], ["vro", "vro", "Võro", "et"],
].map(([code, file, name, ui]) => ({ code, file, name, uiFrom: ui, partial: true }));

// Ігрові терміни інтерфейсу: готовий переклад із Minecraft надійніший за машинний
const GLOSSARY = {
    "Інвентар": "container.inventory", "Лазурит": "item.minecraft.lapis_lazuli", "Верстак": "block.minecraft.crafting_table",
    "Сила": "effect.minecraft.strength", "Швидкість": "effect.minecraft.speed", "Везіння": "effect.minecraft.luck",
    "Регенерація": "effect.minecraft.regeneration", "Нічне бачення": "effect.minecraft.night_vision",
    "Вогнестійкість": "effect.minecraft.fire_resistance", "Насиченість": "effect.minecraft.saturation", "Скасувати": "gui.cancel",
    "Мова": "options.language.title", "Статистика": "gui.stats", "Предмети": "stat.itemsButton", "Блоки": "stat.blocksButton",
    "Усе": "gui.all", "Гравець": "gamerule.category.player", "Мапа": "item.minecraft.filled_map",
    "Міцність: {current} / {max}": "item.durability",
};

// Мова без власного перекладу інтерфейсу бере його зі спорідненої, а не з англійської
const UI_PARENTS = { "fr-CA": "fr", "pt-PT": "pt", yue: "zh-TW" };

// Короткі слова без контексту перекладаються хибно: Home стає домівкою, Second секундою
const TRANSLATION_HINTS = { Home: "Home page", Second: "Second item", Collect: "Collect the reward", Wood: "Wood logs" };
const machineText = text => TRANSLATION_HINTS[text] ?? text;

const SCRIPT_FONTS = {
    Arabic: "Noto Sans Arabic", Hebrew: "Noto Sans Hebrew", Devanagari: "Noto Sans Devanagari", Bengali: "Noto Sans Bengali",
    Gurmukhi: "Noto Sans Gurmukhi", Gujarati: "Noto Sans Gujarati", Oriya: "Noto Sans Oriya", Tamil: "Noto Sans Tamil",
    Telugu: "Noto Sans Telugu", Kannada: "Noto Sans Kannada", Malayalam: "Noto Sans Malayalam", Sinhala: "Noto Sans Sinhala",
    Thai: "Noto Sans Thai", Lao: "Noto Sans Lao", Khmer: "Noto Sans Khmer", Myanmar: "Noto Sans Myanmar",
    Georgian: "Noto Sans Georgian", Armenian: "Noto Sans Armenian", Ethiopic: "Noto Sans Ethiopic", Tibetan: "Noto Serif Tibetan",
    Canadian_Aboriginal: "Noto Sans Canadian Aboriginal", Ol_Chiki: "Noto Sans Ol Chiki", Meetei_Mayek: "Noto Sans Meetei Mayek",
    Nko: "Noto Sans NKo", Tifinagh: "Noto Sans Tifinagh", Thaana: "Noto Sans Thaana", Gothic: "Noto Sans Gothic",
    Hiragana: "Noto Sans JP", Hangul: "Noto Sans KR", Han: "Noto Sans TC",
};
const RTL_SCRIPTS = new Set(["Arabic", "Hebrew", "Nko", "Thaana"]);
// Ієрогліфи є в кожній системі, а їхні шрифти важать мегабайти: у списку мов вони не вантажаться
const SYSTEM_SCRIPTS = new Set(["Han", "Hiragana", "Hangul"]);

const readJson = (file, fallback) => fs.readFile(file, "utf8").then(JSON.parse).catch(() => fallback);
const writeJson = (file, data) => fs.writeFile(file, JSON.stringify(data));
const log = message => console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

const translator = createTranslator({ log, apiKey: process.env.GOOGLE_TRANSLATE_API_KEY });
let translatorBlocked = false;

async function runPool(entries, worker, concurrency = CONCURRENCY) {
    const queue = [...entries];
    await Promise.all(Array.from({ length: concurrency }, async () => {
        while (queue.length) await worker(queue.shift());
    }));
}

function detectScript(texts) {
    const counts = new Map();
    for (const text of texts) {
        for (const script of Object.keys(SCRIPT_FONTS)) {
            const found = text.match(new RegExp(`\\p{Script=${script}}`, "gu"))?.length ?? 0;
            if (found) counts.set(script, (counts.get(script) ?? 0) + found);
        }
        const latin = text.match(/\p{Script=Latin}|\p{Script=Cyrillic}|\p{Script=Greek}/gu)?.length ?? 0;
        counts.set("Latin", (counts.get("Latin") ?? 0) + latin);
    }
    if (counts.has("Hiragana") || counts.has("Katakana")) return "Hiragana";
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

const fontAxes = new Map();

// Деякі шрифти мають лише одну товщину, і Google Fonts відмовляє на запит кількох
async function fontFor(family) {
    if (!fontAxes.has(family)) {
        const url = `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@400;700&display=swap`;
        const response = await fetch(url).catch(() => null);
        fontAxes.set(family, response?.ok ? ":wght@400;700" : "");
    }
    const axis = fontAxes.get(family);
    return axis ? { family, axis } : { family };
}

function nativeNameFromIntl(code) {
    try {
        const tag = new Intl.Locale(code).toString();
        if (!Intl.DisplayNames.supportedLocalesOf([tag]).length) return null;
        const name = new Intl.DisplayNames([tag], { type: "language", fallback: "none" }).of(tag);
        return name ? name[0].toLocaleUpperCase(tag) + name.slice(1) : null;
    } catch {
        return null;
    }
}

async function loadCache(code) {
    return await readJson(path.join(cacheDir, `${code}.json`), {});
}

const loadManual = async code => await readJson(path.join(manualDir, `${code}.json`), {});

// Перекладає лише те, чого ще немає в кеші мови
async function fillCache(code, texts) {
    if (translatorBlocked) return;
    const cache = await loadCache(code);
    const missing = [...new Set(texts)].filter(text => cache[text] === undefined);
    if (!missing.length) return;
    try {
        await translator.translate(code, missing, async translated => {
            for (const [text, value] of translated) cache[text] = value;
            await writeJson(path.join(cacheDir, `${code}.json`), cache);
        });
    } catch (error) {
        if (!(error instanceof TranslatorBlockedError)) throw error;
        translatorBlocked = true;
        log(`${error.message}. Далі збираю без нових перекладів`);
    }
}

// Minecraft пише аргументи як %s або %1$s, інтерфейс гри як {name}
function fromMinecraftFormat(text, key) {
    const names = [...key.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
    let index = 0;
    return text.replace(/%(?:\d+\$)?s/g, match => (names[index] ? `{${names[index++]}}` : match));
}

// Обласні варіанти з мов гри: de_at стає de-AT, інтерфейс береться з основної мови
function regionalVariant(file, languages) {
    const [base, region] = file.split("_");
    const parent = languages.find(language => language.code === base || language.file?.split("_")[0] === base);
    const code = Intl.getCanonicalLocales(`${base}-${region}`)[0];
    const name = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" }).of(code) ?? file;
    return { code, file, name, uiFrom: parent?.code ?? "en", partial: parent ? undefined : true, variant: true };
}

async function main() {
    const { jarPath } = await prepareMinecraftData(version);
    const jar = openJar(jarPath);
    const nameKeys = collectNameKeys(jar);
    const english = jar.json("assets/minecraft/lang/en_us.json");
    const source = JSON.parse(await fs.readFile(path.join(clientRoot, "src/i18n/source.en.json"), "utf8"));
    const uiTextsFor = async code => {
        const manual = await loadManual(code);
        return Object.entries(source).filter(([key]) => manual[key] === undefined).map(([, text]) => machineText(text));
    };
    const uiTexts = Object.values(source).map(machineText);
    const nameTexts = Object.values(nameKeys).flat().map(([, key]) => english[key]).filter(Boolean);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(cacheDir, { recursive: true });

    const available = JSON.parse(await fs.readFile(translatorLanguagesPath, "utf8"));
    const assets = JSON.parse(await fs.readFile(path.resolve(scriptDir, `../../temp/minecraft/${version}/assets.json`), "utf8"));
    const minecraftFiles = Object.keys(assets.objects).filter(name => name.startsWith("minecraft/lang/")).map(name => name.slice(15, -5));

    const languages = Object.entries(available)
        .filter(([code]) => code !== "en" && code !== SOURCE_LANGUAGE)
        .map(([code, name]) => ({
            code, name, translate: true,
            file: MINECRAFT_FILES[code] ?? minecraftFiles.find(file => file === `${code}_${code}`) ?? minecraftFiles.find(file => file.split("_")[0] === code),
        }));
    languages.unshift({ code: "en", name: "English", file: "en_us" }, ...MINECRAFT_ONLY);

    const usedFiles = new Set([...languages.map(language => language.file), `${SOURCE_LANGUAGE}_ua`]);
    languages.push(...minecraftFiles.filter(file => !usedFiles.has(file) && file.includes("_")).map(file => regionalVariant(file, languages)));

    const onlyCodes = process.argv.slice(2).filter(argument => !argument.startsWith("--"));
    const selected = onlyCodes.length ? languages.filter(language => onlyCodes.includes(language.code)) : languages;

    // Спочатку інтерфейс усіх мов: якщо перекладач обмежить запити, гра все одно буде перекладена
    log(`Мов: ${selected.length}. Перекладаю інтерфейс`);
    let done = 0;
    await runPool(selected.filter(language => language.translate && !offline), async language => {
        await fillCache(language.code, await uiTextsFor(language.code)).catch(error => log(`${language.code}: ${error.message}`));
        done += 1;
        if (done % 25 === 0) log(`Інтерфейс: ${done}, запитів: ${translator.requests()}`);
    }, 1);

    log("Завантажую мови Minecraft");
    const minecraft = new Map();
    await runPool(selected.filter(language => language.file), async language => {
        minecraft.set(language.code, await downloadLanguage(version, language.file));
    });

    log("Перекладаю назви для мов без файлу Minecraft або з неповним файлом");
    done = 0;
    await runPool(selected.filter(language => language.translate && withNames && !offline), async language => {
        const file = minecraft.get(language.code);
        const missing = nameTexts.filter(text => !file);
        const untranslated = file ? Object.values(nameKeys).flat().map(([, key]) => key).filter(key => english[key] && (file[key] ?? english[key]) === english[key]).map(key => english[key]) : [];
        await fillCache(language.code, [...missing, ...untranslated]).catch(error => log(`${language.code}: ${error.message}`));
        done += 1;
        if (done % 25 === 0) log(`Назви: ${done}, запитів: ${translator.requests()}`);
    }, 1);

    log("Записую файли");
    const summary = [];
    const skipped = [];
    const botTexts = {};
    const uiFor = new Map();

    const buildUi = async language => {
        if (language.code === "en") return { ...source };
        if (language.uiFrom === SOURCE_LANGUAGE) return {};
        if (language.uiFrom) return uiFor.get(language.uiFrom) ?? await buildUi(languages.find(entry => entry.code === language.uiFrom));

        const cache = await loadCache(language.code);
        const manual = await loadManual(language.code);
        const file = minecraft.get(language.code);
        const parentCode = UI_PARENTS[language.code];
        const parent = parentCode ? await buildUi(languages.find(entry => entry.code === parentCode)) : {};
        const ui = {};
        for (const [key, text] of Object.entries(source)) {
            const glossary = file?.[GLOSSARY[key]];
            ui[key] = glossary && glossary !== english[GLOSSARY[key]]
                ? fromMinecraftFormat(glossary, key)
                : manual[key] ?? cache[machineText(text)] ?? parent[key] ?? text;
        }
        uiFor.set(language.code, ui);
        return ui;
    };

    const ordered = [...selected].sort((left, right) => Number(Boolean(left.partial || left.variant)) - Number(Boolean(right.partial || right.variant)));
    for (const language of ordered) {
        const cache = language.translate ? await loadCache(language.code) : {};
        const file = minecraft.get(language.code);
        const ui = await buildUi(language);
        const names = {};
        let fallback = 0;
        let total = 0;

        for (const [group, entries] of Object.entries(nameKeys)) {
            names[group] = {};
            for (const [id, key] of entries) {
                const base = english[key];
                if (!base) continue;
                total += 1;
                const value = file?.[key] && file[key] !== base ? file[key] : cache[base] ?? (language.code === "en" ? base : file?.[key] ?? base);
                if (value === base && language.code !== "en") fallback += 1;
                names[group][id] = value;
            }
        }

        // Назви з файлу гри завжди рідною мовою, а інтерфейс може бути англійським і перекрити письмо
        const script = detectScript(file ? Object.values(names.items).slice(0, 300) : Object.values(ui));
        const family = script === "Han" && language.code === "zh-CN" ? "Noto Sans SC" : SCRIPT_FONTS[script];
        // Вважаємо за фактом: рядок лишився англійським, хоч би звідки мав прийти переклад
        const isEnglish = language.code === "en" || language.file?.startsWith("en_");
        const uiMissing = language.partial || isEnglish ? 0 : Object.keys(source).filter(key => ui[key] === undefined || ui[key] === source[key]).length;
        const uiIncomplete = uiMissing > uiTexts.length * MAX_MISSING_UI_SHARE;

        // Без перекладу інтерфейсу й без файлу Minecraft мова нічим не відрізнялась би від англійської
        if (uiIncomplete && !file) {
            skipped.push(language.code);
            continue;
        }

        const ownName = file?.["language.name"];
        const region = language.variant ? file?.["language.region"] : null;
        const native = ownName && (ownName !== "English" || isEnglish)
            ? (region ? `${ownName} (${region})` : ownName)
            : nativeNameFromIntl(language.code) ?? language.name;

        const font = family ? await fontFor(family) : undefined;
        const meta = { code: language.code, native, name: language.name, rtl: RTL_SCRIPTS.has(script), font };
        await writeJson(path.join(outputDir, `${language.code}.json`), { meta, ui, ...names });

        summary.push({
            code: language.code, native, name: language.name, partial: language.partial || uiIncomplete ? true : undefined, uiMissing, namesFallback: fallback, namesTotal: total,
            listFont: family && !SYSTEM_SCRIPTS.has(script) ? font : undefined, region: file?.["language.region"],
        });
        if (ui["Натисни кнопку, щоб відкрити гру"]) botTexts[language.code] = { prompt: ui["Натисни кнопку, щоб відкрити гру"], play: ui["Грати"] };
    }

    if (!onlyCodes.length) {
        // Дві мови з однаковою назвою в списку розрізняє регіон: Português (Brasil) і Português (Portugal)
        const sameName = summary.map(entry => entry.native);
        const list = summary
            .map(({ code, native, name, partial, listFont, region }) => ({
                code, name, partial, font: listFont,
                native: region && sameName.indexOf(native) !== sameName.lastIndexOf(native) ? `${native} (${region})` : native,
            }))
            .sort((left, right) => left.name.localeCompare(right.name, "en"));
        await writeJson(path.join(outputDir, "languages.json"), list);
        await fs.writeFile(botTextsPath, JSON.stringify(botTexts, null, 0));
    }

    const incomplete = summary.filter(entry => entry.uiMissing);
    log(`Готово. Мов: ${summary.length}, запитів: ${translator.requests()}`);
    log(`Пропущено (${skipped.length}): ${skipped.join(" ") || "нічого"}`);
    log(`Без повного інтерфейсу: ${incomplete.map(entry => `${entry.code}(${entry.uiMissing})`).join(" ") || "немає"}`);
    log(`Найбільше англійських назв: ${summary.filter(entry => !entry.partial).sort((left, right) => right.namesFallback - left.namesFallback).slice(0, 15).map(entry => `${entry.code}:${entry.namesFallback}/${entry.namesTotal}`).join(" ")}`);
    await writeJson(path.join(cacheDir, "_summary.json"), summary);
}

main().catch(error => {
    console.error("Could not build locales:", error);
    process.exitCode = 1;
});
