// Рецепти, які в Minecraft описані кодом: результат залежить від властивостей предметів у сітці.
// Кожен обробник отримує cells (9 комірок або null) і повертає { result, keep } або null.

const DYE_COLORS = {
    white: 0xF9FFFE, orange: 0xF9801D, magenta: 0xC74EBD, light_blue: 0x3AB3DA, yellow: 0xFED83D, lime: 0x80C71F,
    pink: 0xF38BAA, gray: 0x474F52, light_gray: 0x9D9D97, cyan: 0x169C9C, purple: 0x8932B8, blue: 0x3C44AA,
    brown: 0x835432, green: 0x5E7C16, red: 0xB02E26, black: 0x1D1D21,
};

const dyeColorOf = slug => DYE_COLORS[slug.replace(/_dye$/, "")];
const filled = cells => cells.map((cell, index) => (cell ? { ...cell, index } : null)).filter(Boolean);
const accepts = (group, cell) => Boolean(group?.includes(cell.slug));

function mixColors(colors) {
    const channels = colors.reduce((sum, color) => {
        sum.red += (color >> 16) & 255;
        sum.green += (color >> 8) & 255;
        sum.blue += color & 255;
        sum.brightest += Math.max((color >> 16) & 255, (color >> 8) & 255, color & 255);
        return sum;
    }, { red: 0, green: 0, blue: 0, brightest: 0 });
    const count = colors.length;
    const red = channels.red / count, green = channels.green / count, blue = channels.blue / count;
    const gain = (channels.brightest / count) / (Math.max(red, green, blue) || 1);
    return (Math.floor(red * gain) << 16) + (Math.floor(green * gain) << 8) + Math.floor(blue * gain);
}

function repairItem(cells, { catalog }) {
    const parts = filled(cells);
    if (parts.length !== 2 || parts[0].slug !== parts[1].slug) return null;
    const item = catalog.itemBySlug.get(parts[0].slug);
    if (!item?.maxDurability) return null;
    const remaining = parts.reduce((sum, part) => sum + item.maxDurability - (part.components?.damage ?? 0), 0);
    const repaired = Math.min(item.maxDurability, remaining + Math.floor(item.maxDurability * 0.05));
    return { result: { slug: item.slug, quantity: 1, components: { damage: item.maxDurability - repaired } } };
}

function dye(cells, { recipe }) {
    const parts = filled(cells);
    const targets = parts.filter(part => accepts(recipe.data.target, part));
    const dyes = parts.filter(part => accepts(recipe.data.dye, part));
    if (targets.length !== 1 || !dyes.length || targets.length + dyes.length !== parts.length) return null;
    const target = targets[0];
    const colors = dyes.map(part => dyeColorOf(part.slug));
    if (target.components?.dyed_color !== undefined) colors.push(target.components.dyed_color);
    return { result: { slug: target.slug, quantity: 1, components: { ...target.components, dyed_color: mixColors(colors) } } };
}

function bannerDuplicate(cells, { recipe }) {
    const parts = filled(cells);
    if (parts.length !== 2 || !parts.every(part => accepts(recipe.data.banner, part))) return null;
    const withPatterns = parts.filter(part => part.components?.banner_patterns?.length);
    if (withPatterns.length !== 1) return null;
    const source = withPatterns[0];
    return { result: { slug: source.slug, quantity: 1, components: source.components }, keep: [source.index] };
}

function bookCloning(cells, { recipe }) {
    const parts = filled(cells);
    const sources = parts.filter(part => accepts(recipe.data.source, part));
    const copies = parts.filter(part => accepts(recipe.data.material, part));
    if (sources.length !== 1 || !copies.length || copies.length > 8 || sources.length + copies.length !== parts.length) return null;
    const source = sources[0];
    const generation = source.components?.generation ?? 0;
    if (generation >= 2) return null;
    return {
        result: { slug: "written_book", quantity: copies.length, components: { ...source.components, generation: generation + 1 } },
        keep: [source.index],
    };
}

function decoratedPot(cells, { recipe }) {
    const sides = { back: 1, left: 3, right: 5, front: 7 };
    const occupied = filled(cells).map(part => part.index).sort((a, b) => a - b);
    if (occupied.join() !== "1,3,5,7") return null;
    for (const [side, index] of Object.entries(sides)) if (!accepts(recipe.data[side], cells[index])) return null;
    const decorations = ["back", "left", "right", "front"].map(side => cells[sides[side]].slug);
    return { result: { slug: "decorated_pot", quantity: 1, components: { pot_decorations: decorations } } };
}

function fireworkRocket(cells, { recipe }) {
    const parts = filled(cells);
    const shells = parts.filter(part => accepts(recipe.data.shell, part));
    const fuels = parts.filter(part => accepts(recipe.data.fuel, part));
    const stars = parts.filter(part => accepts(recipe.data.star, part));
    if (shells.length !== 1 || fuels.length < 1 || fuels.length > 3) return null;
    if (shells.length + fuels.length + stars.length !== parts.length) return null;
    return {
        result: {
            slug: "firework_rocket",
            quantity: recipe.result?.quantity ?? 3,
            components: { fireworks: { flight_duration: fuels.length, explosions: stars.map(star => star.components?.firework_explosion).filter(Boolean) } },
        },
    };
}

function fireworkStar(cells, { recipe }) {
    const parts = filled(cells);
    const { fuel, dye: dyes, shapes, trail, twinkle } = recipe.data;
    if (parts.filter(part => accepts(fuel, part)).length !== 1) return null;
    const colors = parts.filter(part => accepts(dyes, part)).map(part => dyeColorOf(part.slug));
    if (!colors.length) return null;
    let shape = "small_ball", used = 1 + colors.length, hasTrail = false, hasTwinkle = false;
    for (const part of parts) {
        const shapeName = Object.keys(shapes).find(name => accepts(shapes[name], part));
        if (shapeName) {
            if (shape !== "small_ball") return null;
            shape = shapeName;
            used += 1;
        } else if (accepts(trail, part) && !hasTrail) {
            hasTrail = true;
            used += 1;
        } else if (accepts(twinkle, part) && !hasTwinkle) {
            hasTwinkle = true;
            used += 1;
        }
    }
    if (used !== parts.length) return null;
    return {
        result: {
            slug: "firework_star",
            quantity: 1,
            components: { firework_explosion: { shape, colors, has_trail: hasTrail, has_twinkle: hasTwinkle } },
        },
    };
}

function fireworkStarFade(cells, { recipe }) {
    const parts = filled(cells);
    const stars = parts.filter(part => accepts(recipe.data.target, part));
    const dyes = parts.filter(part => accepts(recipe.data.dye, part));
    if (stars.length !== 1 || !dyes.length || stars.length + dyes.length !== parts.length) return null;
    const explosion = stars[0].components?.firework_explosion;
    if (!explosion) return null;
    return {
        result: {
            slug: "firework_star",
            quantity: 1,
            components: { firework_explosion: { ...explosion, fade_colors: dyes.map(part => dyeColorOf(part.slug)) } },
        },
    };
}

function mapExtending(cells, { recipe }) {
    const parts = filled(cells);
    if (parts.length !== 9 || !accepts(recipe.data.map, cells[4])) return null;
    if (!parts.every(part => part.index === 4 || accepts(recipe.data.material, part))) return null;
    const scale = cells[4].components?.map_scale ?? 0;
    if (scale >= 4) return null;
    return { result: { slug: cells[4].slug, quantity: 1, components: { ...cells[4].components, map_scale: scale + 1 } } };
}

function shieldDecoration(cells, { recipe }) {
    const parts = filled(cells);
    const shields = parts.filter(part => accepts(recipe.data.target, part));
    const banners = parts.filter(part => accepts(recipe.data.banner, part));
    if (parts.length !== 2 || shields.length !== 1 || banners.length !== 1) return null;
    if (shields[0].components?.banner_patterns) return null;
    const banner = banners[0];
    return {
        result: {
            slug: "shield",
            quantity: 1,
            components: { ...shields[0].components, base_color: banner.slug.replace(/_banner$/, ""), banner_patterns: banner.components?.banner_patterns ?? [] },
        },
    };
}

function imbue(cells, { recipe }) {
    const parts = filled(cells);
    if (parts.length !== 9 || !accepts(recipe.data.source, cells[4])) return null;
    if (!parts.every(part => part.index === 4 || accepts(recipe.data.material, part))) return null;
    return {
        result: {
            slug: recipe.result.slug,
            quantity: recipe.result.quantity,
            components: cells[4].components?.potion ? { potion: cells[4].components.potion } : undefined,
        },
    };
}

const HANDLERS = {
    repairitem: repairItem,
    dye,
    bannerduplicate: bannerDuplicate,
    bookcloning: bookCloning,
    decorated_pot: decoratedPot,
    firework_rocket: fireworkRocket,
    firework_star: fireworkStar,
    firework_star_fade: fireworkStarFade,
    mapextending: mapExtending,
    shielddecoration: shieldDecoration,
    imbue,
};

export function matchTransmute(cells, recipe) {
    const parts = filled(cells);
    const inputs = parts.filter(part => accepts(recipe.data.input, part));
    const materials = parts.filter(part => accepts(recipe.data.material, part));
    if (inputs.length !== 1 || inputs.length + materials.length !== parts.length) return null;
    if (materials.length < recipe.data.minMaterial || materials.length > recipe.data.maxMaterial) return null;
    const input = inputs[0];
    const slug = recipe.result?.slug ?? input.slug;
    const quantity = recipe.data.addMaterialCount ? materials.length + 1 : 1;
    if (slug === input.slug && !recipe.data.addMaterialCount) return null;
    return { result: { slug, quantity, components: input.components } };
}

export function matchSpecial(cells, recipe, catalog) {
    return HANDLERS[recipe.specialType]?.(cells, { recipe, catalog }) ?? null;
}
