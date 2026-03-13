function getRandomDropItems(dropArray) {
  if (!Array.isArray(dropArray) || dropArray.length === 0) {
    return null;
  }

  // Підрахунок сумарного шансу
  const totalChance = dropArray.reduce((sum, item) => sum + item.chance, 0);

  // Випадкове число від 0 до totalChance
  const rand = Math.random() * totalChance;

  // Вибираємо дроп
  let cumulative = 0;
  for (const drop of dropArray) {
    cumulative += drop.chance;
    if (rand < cumulative) {
      return drop;
    }
  }

  // На випадок, якщо щось пішло не так (маєте повернути останній)
  return dropArray[dropArray.length - 1];
}

export { getRandomDropItems };