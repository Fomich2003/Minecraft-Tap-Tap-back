import fs from "node:fs";
import { inflateRawSync } from "node:zlib";

// Мінімальний читач ZIP: JAR Minecraft використовується лише як архів з даними
export function openJar(jarPath) {
    const buffer = fs.readFileSync(jarPath);
    let endOffset = -1;
    for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) { endOffset = offset; break; }
    }
    if (endOffset < 0) throw new Error(`Could not read JAR directory: ${jarPath}`);

    const entries = new Map();
    const count = buffer.readUInt16LE(endOffset + 10);
    let cursor = buffer.readUInt32LE(endOffset + 16);
    for (let index = 0; index < count; index += 1) {
        const nameLength = buffer.readUInt16LE(cursor + 28);
        entries.set(buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength), {
            method: buffer.readUInt16LE(cursor + 10),
            size: buffer.readUInt32LE(cursor + 20),
            offset: buffer.readUInt32LE(cursor + 42),
        });
        cursor += 46 + nameLength + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    }

    const read = name => {
        const entry = entries.get(name);
        if (!entry) return null;
        const start = entry.offset + 30 + buffer.readUInt16LE(entry.offset + 26) + buffer.readUInt16LE(entry.offset + 28);
        const data = buffer.subarray(start, start + entry.size);
        return entry.method === 0 ? data : inflateRawSync(data);
    };

    return {
        names: [...entries.keys()],
        has: name => entries.has(name),
        read,
        json: name => {
            const data = read(name);
            return data ? JSON.parse(data.toString("utf8")) : null;
        },
    };
}
