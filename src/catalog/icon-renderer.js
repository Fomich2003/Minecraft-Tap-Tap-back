import { PNG } from "pngjs";

const SIZE = 64;
const GRASS_TINT = 0x91BD59;
const FOLIAGE_TINT = 0x77AB2F;
const DEFAULT_GUI = { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] };
const FLAT_ITEM_ROOTS = /^(item\/generated|item\/handheld|builtin\/generated)/;

const DYE_RGB = {
    white: 0xF9FFFE, orange: 0xF9801D, magenta: 0xC74EBD, light_blue: 0x3AB3DA, yellow: 0xFED83D, lime: 0x80C71F,
    pink: 0xF38BAA, gray: 0x474F52, light_gray: 0x9D9D97, cyan: 0x169C9C, purple: 0x8932B8, blue: 0x3C44AA,
    brown: 0x835432, green: 0x5E7C16, red: 0xB02E26, black: 0x1D1D21,
};

const strip = value => value.replace(/^minecraft:/, "");
const radians = degrees => degrees * Math.PI / 180;

function createCanvas(size) {
    return { size, color: new Float32Array(size * size * 4), depth: new Float32Array(size * size).fill(-Infinity) };
}

function blendPixel(canvas, index, red, green, blue, alpha) {
    const offset = index * 4;
    const { color } = canvas;
    const inverse = 1 - alpha;
    const outAlpha = alpha + color[offset + 3] * inverse;
    if (outAlpha <= 0) return;
    color[offset] = (red * alpha + color[offset] * color[offset + 3] * inverse) / outAlpha;
    color[offset + 1] = (green * alpha + color[offset + 1] * color[offset + 3] * inverse) / outAlpha;
    color[offset + 2] = (blue * alpha + color[offset + 2] * color[offset + 3] * inverse) / outAlpha;
    color[offset + 3] = outAlpha;
}

function encode(canvas) {
    const png = new PNG({ width: canvas.size, height: canvas.size });
    for (let index = 0; index < canvas.size * canvas.size; index += 1) {
        for (let channel = 0; channel < 3; channel += 1) png.data[index * 4 + channel] = Math.round(canvas.color[index * 4 + channel]);
        png.data[index * 4 + 3] = Math.round(canvas.color[index * 4 + 3] * 255);
    }
    return PNG.sync.write(png);
}

function rotationMatrix([x, y, z]) {
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(radians(x)), Math.sin(radians(x)), Math.cos(radians(y)), Math.sin(radians(y)), Math.cos(radians(z)), Math.sin(radians(z))];
    // Rx * Ry * Rz, як у ванільному перетворенні предмета
    return [
        [cy * cz, -cy * sz, sy],
        [sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy],
        [-cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy],
    ];
}

const multiply = (matrix, vector) => matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);

function quaternionMatrix([x, y, z, w]) {
    return [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ];
}

function applyTransformation(point, transformation) {
    if (!transformation) return point;
    const { left_rotation: left, right_rotation: right, scale, translation } = transformation;
    let value = right ? multiply(quaternionMatrix(right), point) : point;
    if (scale) value = value.map((component, axis) => component * scale[axis]);
    if (left) value = multiply(quaternionMatrix(left), value);
    return translation ? value.map((component, axis) => component + translation[axis]) : value;
}

function rotateElementPoint(point, rotation) {
    if (!rotation?.axis) return point;
    const axis = "xyz".indexOf(rotation.axis);
    const cos = Math.cos(radians(rotation.angle)), sin = Math.sin(radians(rotation.angle));
    const [a, b] = [(axis + 1) % 3, (axis + 2) % 3];
    const relative = point.map((value, index) => value - rotation.origin[index]);
    const rotated = [...relative];
    rotated[a] = relative[a] * cos - relative[b] * sin;
    rotated[b] = relative[a] * sin + relative[b] * cos;
    return rotated.map((value, index) => value + rotation.origin[index]);
}

const FACE_CORNERS = {
    up: ([a, b, c], [d, e, f]) => [[a, e, c], [a, e, f], [d, e, f], [d, e, c]],
    down: ([a, b, c], [d, e, f]) => [[a, b, f], [a, b, c], [d, b, c], [d, b, f]],
    north: ([a, b, c], [d, e, f]) => [[d, e, c], [d, b, c], [a, b, c], [a, e, c]],
    south: ([a, b, c], [d, e, f]) => [[a, e, f], [a, b, f], [d, b, f], [d, e, f]],
    west: ([a, b, c], [d, e, f]) => [[a, e, c], [a, b, c], [a, b, f], [a, e, f]],
    east: ([a, b, c], [d, e, f]) => [[d, e, f], [d, b, f], [d, b, c], [d, e, c]],
};

const defaultUv = (face, [a, b, c], [d, e, f]) => ({
    up: [a, c, d, f], down: [a, 16 - f, d, 16 - c], north: [16 - d, 16 - e, 16 - a, 16 - b],
    south: [a, 16 - e, d, 16 - b], west: [c, 16 - e, f, 16 - b], east: [16 - f, 16 - e, 16 - c, 16 - b],
}[face]);

function rasterTriangle(canvas, [p0, p1, p2], texture, tint, shade) {
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(canvas.size - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(canvas.size - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    if (Math.abs(area) < 1e-6) return;

    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const px = x + 0.5, py = y + 0.5;
            const w1 = ((px - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (py - p0.y)) / area;
            const w2 = ((p1.x - p0.x) * (py - p0.y) - (px - p0.x) * (p1.y - p0.y)) / area;
            const w0 = 1 - w1 - w2;
            if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;

            const depth = w0 * p0.z + w1 * p1.z + w2 * p2.z;
            const index = y * canvas.size + x;
            if (depth < canvas.depth[index]) continue;

            const u = w0 * p0.u + w1 * p1.u + w2 * p2.u;
            const v = w0 * p0.v + w1 * p1.v + w2 * p2.v;
            const sampleX = Math.min(texture.width - 1, Math.max(0, Math.floor(u * texture.width)));
            const sampleY = Math.min(texture.height - 1, Math.max(0, Math.floor(v * texture.height)));
            const offset = (sampleY * texture.width + sampleX) * 4;
            const alpha = texture.data[offset + 3] / 255;
            if (alpha === 0) continue;

            blendPixel(canvas, index,
                texture.data[offset] * shade * ((tint >> 16) & 255) / 255,
                texture.data[offset + 1] * shade * ((tint >> 8) & 255) / 255,
                texture.data[offset + 2] * shade * (tint & 255) / 255,
                alpha);
            if (alpha > 0.8) canvas.depth[index] = depth;
        }
    }
}

export function createIconRenderer(jar) {
    const textures = new Map();

    const loadTexture = path => {
        if (textures.has(path)) return textures.get(path);
        const data = jar.read(`assets/minecraft/textures/${path}.png`);
        let texture = null;
        if (data) {
            const png = PNG.sync.read(data);
            // Анімовані текстури це вертикальна стрічка кадрів: беремо перший
            texture = { width: png.width, height: png.height > png.width && png.height % png.width === 0 ? png.width : png.height, data: png.data };
        }
        textures.set(path, texture);
        return texture;
    };

    const loadModel = name => {
        const merged = { textures: {}, elements: null, gui: null, chain: [] };
        let current = strip(name);
        for (let depth = 0; current && depth < 16; depth += 1) {
            merged.chain.push(current);
            const data = jar.json(`assets/minecraft/models/${current}.json`);
            if (!data) break;
            merged.textures = { ...data.textures, ...merged.textures };
            merged.elements ??= data.elements ?? null;
            merged.gui ??= data.display?.gui ?? null;
            current = data.parent ? strip(data.parent) : null;
        }
        return merged;
    };

    const resolveTexture = (reference, map) => {
        const pathOf = value => (typeof value === "object" && value ? value.sprite : value);
        let value = pathOf(reference);
        for (let depth = 0; depth < 8 && value && (value.startsWith("#") || map[value]); depth += 1) value = pathOf(map[value.replace("#", "")]);
        return value ? strip(value) : null;
    };

    const tintColor = (tint, fallback = 0xFFFFFF) => {
        if (!tint) return fallback;
        const value = tint.value ?? tint.default;
        if (typeof value === "number") return value & 0xFFFFFF;
        if (tint.type === "minecraft:grass") return GRASS_TINT;
        return fallback;
    };

    const collectEntries = (node, entries = []) => {
        if (!node) return entries;
        switch (node.type) {
            case "minecraft:model": entries.push({ model: node.model, tints: node.tints ?? [] }); break;
            case "minecraft:special": entries.push({ special: node.model, base: node.base, transformation: node.transformation }); break;
            case "minecraft:composite": node.models.forEach(model => collectEntries(model, entries)); break;
            case "minecraft:select": {
                const guiCase = node.cases?.find(entry => [entry.when].flat().includes("gui"));
                collectEntries(guiCase?.model ?? node.fallback ?? node.cases?.[0]?.model, entries);
                break;
            }
            case "minecraft:condition": collectEntries(node.on_false, entries); break;
            case "minecraft:range_dispatch": collectEntries(node.fallback ?? node.entries?.[0]?.model, entries); break;
            default: collectEntries(node.fallback, entries);
        }
        return entries;
    };

    const drawFlat = (canvas, entry, model) => {
        for (let layer = 0; layer < 8; layer += 1) {
            const path = resolveTexture(model.textures[`layer${layer}`], model.textures);
            if (!path) continue;
            const texture = loadTexture(path);
            if (!texture) continue;
            const tint = tintColor(entry.tints?.[layer]);
            for (let y = 0; y < canvas.size; y += 1) {
                for (let x = 0; x < canvas.size; x += 1) {
                    const sampleX = Math.floor(x / canvas.size * texture.width), sampleY = Math.floor(y / canvas.size * texture.height);
                    const offset = (sampleY * texture.width + sampleX) * 4;
                    if (!texture.data[offset + 3]) continue;
                    blendPixel(canvas, y * canvas.size + x,
                        texture.data[offset] * ((tint >> 16) & 255) / 255, texture.data[offset + 1] * ((tint >> 8) & 255) / 255,
                        texture.data[offset + 2] * (tint & 255) / 255, texture.data[offset + 3] / 255);
                }
            }
        }
    };

    const drawElements = (canvas, elements, textureOf, gui, transformation, tintOf) => {
        const rotation = rotationMatrix(gui.rotation ?? DEFAULT_GUI.rotation);
        const scale = gui.scale ?? DEFAULT_GUI.scale;
        const translation = gui.translation ?? [0, 0, 0];
        const project = point => {
            const unit = applyTransformation(point.map(value => value / 16), transformation).map(value => value - 0.5);
            const scaled = unit.map((value, axis) => value * scale[axis]);
            const view = multiply(rotation, scaled).map((value, axis) => value + translation[axis] / 16);
            return { x: canvas.size / 2 + view[0] * canvas.size, y: canvas.size / 2 - view[1] * canvas.size, z: view[2] };
        };

        const quads = [];
        for (const element of elements) {
            for (const [face, data] of Object.entries(element.faces ?? {})) {
                const corners = FACE_CORNERS[face](element.from, element.to).map(point => project(rotateElementPoint(point, element.rotation)));
                const [a, b, c] = corners;
                const normal = {
                    x: (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
                    y: (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z),
                    z: (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
                };
                const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
                // Екранна y росте вниз, тому верхня грань має від'ємну y нормалі
                const upness = Math.abs(normal.y / length);
                const facing = face === "up" ? 1 : face === "down" ? 0.45 : (corners[0].x + corners[2].x) / 2 < canvas.size / 2 ? 0.8 : 0.6;
                const shade = Math.min(1, facing + upness * 0.05);
                quads.push({ corners, data, shade, element, face, order: corners.reduce((sum, corner) => sum + corner.z, 0) });
            }
        }

        quads.sort((first, second) => first.order - second.order);
        for (const { corners, data, shade, element, face } of quads) {
            const texture = textureOf(data.texture);
            if (!texture) continue;
            const [u1, v1, u2, v2] = data.uv ?? defaultUv(face, element.from, element.to);
            const uv = [[u1, v1], [u1, v2], [u2, v2], [u2, v1]];
            const turn = ((data.rotation ?? 0) / 90) & 3;
            const scaleU = data.uvSize ?? 16;
            const points = corners.map((corner, index) => {
                const [u, v] = uv[(index + turn) % 4];
                return { ...corner, u: u / scaleU, v: v / (data.uvSizeV ?? scaleU) };
            });
            const tint = data.tintindex === undefined ? 0xFFFFFF : tintOf(data.tintindex);
            rasterTriangle(canvas, [points[0], points[1], points[2]], texture, tint, shade);
            rasterTriangle(canvas, [points[0], points[2], points[3]], texture, tint, shade);
        }
    };

    // Розгортка коробки в текстурі сутності: стандартний макет Minecraft
    const boxFaces = (texturePath, u, v, [width, height, depth], textureSize, flipY) => {
        const uvSize = textureSize;
        const face = (u1, v1, u2, v2) => ({ texture: texturePath, uv: [u1, v1, u2, v2], uvSize });
        return {
            [flipY ? "down" : "up"]: face(u + depth, v, u + depth + width, v + depth),
            [flipY ? "up" : "down"]: face(u + depth + width, v, u + depth + 2 * width, v + depth),
            west: face(u, v + depth, u + depth, v + depth + height),
            south: face(u + depth, v + depth, u + depth + width, v + depth + height),
            east: face(u + depth + width, v + depth, u + depth + width + depth, v + depth + height),
            north: face(u + depth + width + depth, v + depth, u + 2 * depth + 2 * width, v + depth + height),
        };
    };

    const drawBoxes = (canvas, boxes, texturePath, { gui = DEFAULT_GUI, flipY = false } = {}) => {
        const texture = loadTexture(texturePath);
        if (!texture) return false;
        const elements = boxes.map(({ from, to, u, v, size }) => ({
            from, to,
            faces: boxFaces(texturePath, u, v, size ?? [to[0] - from[0], to[1] - from[1], to[2] - from[2]], texture.width, flipY),
        }));
        for (const element of elements) for (const data of Object.values(element.faces)) data.uvSizeV = texture.height;
        drawElements(canvas, elements, path => loadTexture(path), gui, null, () => 0xFFFFFF);
        return true;
    };

    const fillRect = (canvas, x1, y1, x2, y2, color) => {
        for (let y = y1; y < y2; y += 1) for (let x = x1; x < x2; x += 1) {
            blendPixel(canvas, y * canvas.size + x, (color >> 16) & 255, (color >> 8) & 255, color & 255, 1);
        }
    };

    const drawSpecial = (canvas, entry) => {
        const kind = entry.special?.type;
        if (kind === "minecraft:chest") {
            const name = strip(entry.special.texture ?? "normal");
            return drawBoxes(canvas, [
                { from: [1, 0, 1], to: [15, 10, 15], u: 0, v: 19 },
                { from: [1, 9, 1], to: [15, 14, 15], u: 0, v: 0 },
                { from: [7, 7, 15], to: [9, 11, 16], u: 0, v: 0 },
            ], `entity/chest/${name}`, { flipY: true });
        }
        if (kind === "minecraft:shulker_box") {
            return drawBoxes(canvas, [
                { from: [0, 0, 0], to: [16, 8, 16], u: 0, v: 28 },
                { from: [0, 4, 0], to: [16, 16, 16], u: 0, v: 0 },
            ], `entity/shulker/${strip(entry.special.texture ?? "shulker")}`);
        }
        if (kind === "minecraft:conduit") {
            return drawBoxes(canvas, [{ from: [5, 5, 5], to: [11, 11, 11], u: 0, v: 0 }], "entity/conduit/base");
        }
        if (kind === "minecraft:copper_golem_statue") {
            const texture = strip(entry.special.texture).replace("textures/", "").replace(".png", "");
            return drawBoxes(canvas, [
                { from: [3, 8, 2], to: [13, 14, 14], u: 0, v: 0, size: [8, 5, 10] },
                { from: [4, 0, 5], to: [12, 8, 11], u: 0, v: 15, size: [8, 6, 6] },
            ], texture);
        }
        if (kind === "minecraft:player_head") {
            return drawBoxes(canvas, [{ from: [2, 2, 2], to: [14, 14, 14], u: 0, v: 0, size: [8, 8, 8] }], "entity/player/wide/steve");
        }
        if (kind === "minecraft:head") {
            const headTextures = {
                skeleton: "entity/skeleton/skeleton", wither_skeleton: "entity/skeleton/wither_skeleton", zombie: "entity/zombie/zombie",
                creeper: "entity/creeper/creeper", piglin: "entity/piglin/piglin", player: "entity/player/wide/steve", dragon: "entity/enderdragon/dragon",
            };
            const box = { from: [2, 2, 2], to: [14, 14, 14], u: 0, v: 0, size: [8, 8, 8] };
            return drawBoxes(canvas, [box], headTextures[entry.special.kind] ?? "entity/skeleton/skeleton");
        }
        if (kind === "minecraft:banner") {
            const color = DYE_RGB[entry.special.color] ?? 0xFFFFFF;
            fillRect(canvas, 30, 4, 34, 60, 0x6B4A2B);
            fillRect(canvas, 14, 6, 50, 10, 0x6B4A2B);
            fillRect(canvas, 18, 10, 46, 52, color);
            return true;
        }
        if (kind === "minecraft:shield") {
            const texture = loadTexture("entity/shield/shield_base_nopattern");
            if (!texture) return false;
            const scale = texture.width / 64;
            for (let y = 0; y < 44; y += 1) for (let x = 0; x < 24; x += 1) {
                const offset = (Math.floor((1 + y / 2) * scale) * texture.width + Math.floor((1 + x / 2) * scale)) * 4;
                if (!texture.data[offset + 3]) continue;
                blendPixel(canvas, (y + 10) * canvas.size + x + 20, texture.data[offset], texture.data[offset + 1], texture.data[offset + 2], 1);
            }
            return true;
        }
        if (kind === "minecraft:decorated_pot") {
            const side = "entity/decorated_pot/decorated_pot_side";
            const elements = [{
                from: [2, 0, 2], to: [14, 16, 14],
                faces: Object.fromEntries(["north", "south", "west", "east", "up"].map(face => [face, { texture: side, uv: [0, 0, 16, 16] }])),
            }];
            drawElements(canvas, elements, path => loadTexture(path), DEFAULT_GUI, null, () => 0xFFFFFF);
            return true;
        }
        return false;
    };

    const drawModelEntry = (canvas, entry) => {
        const model = loadModel(entry.model ?? entry.base);
        if (model.chain.some(name => FLAT_ITEM_ROOTS.test(name)) || (!model.elements && model.textures.layer0)) {
            drawFlat(canvas, entry, model);
            return true;
        }
        if (!model.elements) return false;
        const textureOf = reference => {
            const path = resolveTexture(reference, model.textures);
            return path ? loadTexture(path) : null;
        };
        const tintOf = index => tintColor(entry.tints?.[index], /leaves/.test(entry.model ?? "") ? FOLIAGE_TINT : 0xFFFFFF);
        drawElements(canvas, model.elements, textureOf, model.gui ?? DEFAULT_GUI, entry.transformation, tintOf);
        return true;
    };

    const isEmpty = canvas => !canvas.color.some((value, index) => index % 4 === 3 && value > 0);

    return {
        render(slug) {
            const definition = jar.json(`assets/minecraft/items/${slug}.json`);
            if (!definition) return null;
            const canvas = createCanvas(SIZE);
            for (const entry of collectEntries(definition.model)) {
                if (entry.special) {
                    if (!drawSpecial(canvas, entry)) drawModelEntry(canvas, entry);
                } else {
                    drawModelEntry(canvas, entry);
                }
            }
            return isEmpty(canvas) ? null : encode(canvas);
        },
    };
}
