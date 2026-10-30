// Зачаровуваність предметів, у даних гри вона є лише в коді
const TOOLS = { wooden: 15, stone: 5, copper: 13, iron: 14, golden: 22, diamond: 10, netherite: 15 };
const ARMOR = { leather: 15, chainmail: 12, copper: 8, iron: 9, golden: 25, diamond: 10, netherite: 15, turtle: 9 };

export function enchantabilityOf(slug) {
    if (slug === "book") return 1;
    if (["bow", "crossbow", "trident", "fishing_rod"].includes(slug)) return 1;
    if (slug === "mace") return 15;
    const tool = slug.match(/^(wooden|stone|copper|iron|golden|diamond|netherite)_(sword|pickaxe|axe|shovel|hoe|spear)$/);
    if (tool) return TOOLS[tool[1]];
    const armor = slug.match(/^(leather|chainmail|copper|iron|golden|diamond|netherite|turtle)_(helmet|chestplate|leggings|boots)$/);
    if (armor) return ARMOR[armor[1]];
    return 0;
}
