import ItemModel from "../models/Item.model.js";

class ItemRepository {
    async findAll() {
        return await ItemModel.find();
    }

    async findById(id) {
        return await ItemModel.findById(id);
    }

    async findBySlug(slug) {
        return await ItemModel.findOne({ slug });
    }

    async findAllBlocks() {
        return await ItemModel.find({ type: "block" })
    }

    async findBlocksToTap() {
        return await ItemModel.find({ canTap: true }).sort({ price: 1, name: 1 })
    }

    async getFirst() {
        return await ItemModel.findOne({ type: "block", isFirst: true })
    }


}

const Item = new ItemRepository();

export default Item;