function maxStackSize(item) {
  return item?.stackable === false ? 1 : Math.max(1, Number(item?.maxStack) || 64);
}

function addInventoryQuantity(inventory, item, quantity) {
  const itemId = item._id;
  const limit = maxStackSize(item);
  let remaining = quantity;

  for (const stack of inventory.items) {
    if (stack.itemId.toString() !== itemId.toString() || stack.quantity >= limit) continue;
    const added = Math.min(limit - stack.quantity, remaining);
    stack.quantity += added;
    remaining -= added;
    if (!remaining) return;
  }

  while (remaining > 0) {
    const stackQuantity = Math.min(limit, remaining);
    inventory.items.push({ itemId, quantity: stackQuantity });
    remaining -= stackQuantity;
  }
}

function removeInventoryQuantity(inventory, itemId, quantity) {
  const stacks = inventory.items.filter(stack => stack.itemId.toString() === itemId.toString());
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

export { maxStackSize, addInventoryQuantity, removeInventoryQuantity };
