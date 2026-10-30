function maxStackSize(item) {
  return item?.stackable === false ? 1 : Math.max(1, Number(item?.maxStack) || 64);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function hasComponents(components) {
  return Boolean(components) && Object.keys(components).length > 0;
}

function stackKeyOf(components) {
  return hasComponents(components) ? JSON.stringify(canonicalize(components)) : "";
}

function addInventoryQuantity(inventory, item, quantity, components) {
  const itemId = item._id;
  const limit = maxStackSize(item);
  const stackKey = stackKeyOf(components);
  let remaining = quantity;

  for (const stack of inventory.items) {
    const sameItem = stack.itemId.toString() === itemId.toString() && (stack.stackKey ?? "") === stackKey;
    if (!sameItem || stack.quantity >= limit) continue;
    const added = Math.min(limit - stack.quantity, remaining);
    stack.quantity += added;
    remaining -= added;
    if (!remaining) return;
  }

  while (remaining > 0) {
    const stackQuantity = Math.min(limit, remaining);
    inventory.items.push({ itemId, quantity: stackQuantity, stackKey, ...(hasComponents(components) ? { components } : {}) });
    remaining -= stackQuantity;
  }
}

function countInventoryQuantity(inventory, itemId, stackKey = "") {
  return inventory.items
    .filter(stack => stack.itemId.toString() === itemId.toString() && (stack.stackKey ?? "") === stackKey)
    .reduce((total, stack) => total + stack.quantity, 0);
}

function removeInventoryQuantity(inventory, itemId, quantity, stackKey = "") {
  const stacks = inventory.items.filter(stack => stack.itemId.toString() === itemId.toString() && (stack.stackKey ?? "") === stackKey);
  const available = stacks.reduce((total, stack) => total + stack.quantity, 0);
  if (available < quantity) return false;

  let remaining = quantity;
  for (const stack of stacks) {
    const removed = Math.min(stack.quantity, remaining);
    stack.quantity -= removed;
    remaining -= removed;
    if (!remaining) break;
  }

  inventory.items = inventory.items.filter(stack => stack.quantity > 0);
  return true;
}

export { maxStackSize, stackKeyOf, addInventoryQuantity, countInventoryQuantity, removeInventoryQuantity };
