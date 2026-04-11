import Sale from "../models/sale.model.js";
import Allocation from "../models/allocation.model.js";
import CostEntry from "../models/costEntry.model.js";
import CostTemplate from "../models/costTemplate.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";

export const createSale = asyncHandlers(async (req, res) => {
  const {
    product_name,
    quantity,
    sale_total,
    currency,
    payment_method,
    bank_id,
    bank_name,
    cash_holder,
    date,
    existing_allocation,
    new_cost_allocation,
  } = req.body;

  const errors = [];

  if (
    !product_name ||
    typeof product_name !== "string" ||
    product_name.trim().length === 0
  ) {
    errors.push({
      field: "product_name",
      message: "Product name is required",
    });
  }

  if (
    quantity !== undefined &&
    (typeof quantity !== "number" || quantity < 1)
  ) {
    errors.push({
      field: "quantity",
      message: "Quantity must be a number greater than or equal to 1",
    });
  }

  if (sale_total === undefined || sale_total === null) {
    errors.push({
      field: "sale_total",
      message: "Sale total is required",
    });
  } else if (typeof sale_total !== "number" || sale_total < 0) {
    errors.push({
      field: "sale_total",
      message: "Sale total must be a positive number",
    });
  }

  if (!payment_method) {
    errors.push({
      field: "payment_method",
      message: "Payment method is required",
    });
  } else if (!["cash", "bank"].includes(payment_method)) {
    errors.push({
      field: "payment_method",
      message: "Payment method must be either 'cash' or 'bank'",
    });
  }

  if (payment_method === "bank") {
    // Bank is optional - either bank_id, bank_name, or both can be provided
    // if (!bank_id && !bank_name) {
    //   errors.push({
    //     field: "bank_id/bank_name",
    //     message: "Bank ID or Bank name is required when payment method is bank",
    //   });
    // }
  }

  if (existing_allocation && new_cost_allocation) {
    errors.push({
      field: "allocation",
      message:
        "Cannot specify both existing_allocation and new_cost_allocation",
    });
  }

  if (existing_allocation) {
    if (!existing_allocation.cost_id) {
      errors.push({
        field: "existing_allocation.cost_id",
        message: "Cost ID is required for existing allocation",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(existing_allocation.cost_id)) {
      errors.push({
        field: "existing_allocation.cost_id",
        message: "Invalid cost ID format",
      });
    }
    if (
      existing_allocation.allocation_quantity !== undefined &&
      (typeof existing_allocation.allocation_quantity !== "number" ||
        existing_allocation.allocation_quantity < 1)
    ) {
      errors.push({
        field: "existing_allocation.allocation_quantity",
        message: "Allocation quantity must be a positive number",
      });
    }
    if (
      existing_allocation.allocation_amount !== undefined &&
      (typeof existing_allocation.allocation_amount !== "number" ||
        existing_allocation.allocation_amount < 0)
    ) {
      errors.push({
        field: "existing_allocation.allocation_amount",
        message: "Allocation amount must be a positive number",
      });
    }
  }

  if (new_cost_allocation) {
    if (
      !new_cost_allocation.description ||
      typeof new_cost_allocation.description !== "string" ||
      new_cost_allocation.description.trim().length === 0
    ) {
      errors.push({
        field: "new_cost_allocation.description",
        message: "Description is required for new cost",
      });
    }
    if (
      new_cost_allocation.quantity === undefined ||
      new_cost_allocation.quantity === null
    ) {
      errors.push({
        field: "new_cost_allocation.quantity",
        message: "Quantity is required for new cost",
      });
    } else if (
      typeof new_cost_allocation.quantity !== "number" ||
      new_cost_allocation.quantity < 1
    ) {
      errors.push({
        field: "new_cost_allocation.quantity",
        message: "Quantity must be at least 1",
      });
    }
    if (
      new_cost_allocation.unit_cost === undefined ||
      new_cost_allocation.unit_cost === null
    ) {
      errors.push({
        field: "new_cost_allocation.unit_cost",
        message: "Unit cost is required for new cost",
      });
    } else if (
      typeof new_cost_allocation.unit_cost !== "number" ||
      new_cost_allocation.unit_cost < 0
    ) {
      errors.push({
        field: "new_cost_allocation.unit_cost",
        message: "Unit cost must be a positive number",
      });
    }
    if (
      new_cost_allocation.allocation_quantity !== undefined &&
      (typeof new_cost_allocation.allocation_quantity !== "number" ||
        new_cost_allocation.allocation_quantity < 1)
    ) {
      errors.push({
        field: "new_cost_allocation.allocation_quantity",
        message: "Allocation quantity must be a positive number",
      });
    }
    if (
      new_cost_allocation.allocation_amount !== undefined &&
      (typeof new_cost_allocation.allocation_amount !== "number" ||
        new_cost_allocation.allocation_amount < 0)
    ) {
      errors.push({
        field: "new_cost_allocation.allocation_amount",
        message: "Allocation amount must be a positive number",
      });
    }
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation failed", errors);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.create(
      [
        {
          user_id: req.user._id,
          product_name: product_name.trim(),
          quantity: quantity || 1,
          sale_total,
          currency: currency || "BDT",
          payment_method,
          bank_id: bank_id || null,
          bank_name: bank_name || null,
          cash_holder: cash_holder || null,
          date: date ? new Date(date) : new Date(),
          status: "completed",
        },
      ],
      { session }
    );

    const allocationsCreated = [];
    const newCostsCreated = [];

    if (existing_allocation) {
      const costEntry = await CostEntry.findOne({
        _id: existing_allocation.cost_id,
        user_id: req.user._id,
      });

      if (!costEntry) {
        throw new ApiErrors(404, "Cost entry not found");
      }

      const remainingQuantity =
        costEntry.quantity - (costEntry.allocated_quantity || 0);
      const remainingAmount =
        costEntry.total_cost - (costEntry.allocated_amount || 0);

      const allocationQty =
        existing_allocation.allocation_quantity || Math.ceil(remainingQuantity);
      const finalAllocationQty = Math.min(allocationQty, remainingQuantity);

      let allocationAmt = existing_allocation.allocation_amount;
      if (!allocationAmt) {
        allocationAmt = finalAllocationQty * costEntry.unit_cost;
      }

      if (finalAllocationQty <= 0 || allocationAmt <= 0) {
        throw new ApiErrors(400, "No remaining quantity or amount to allocate");
      }

      const allocation = await Allocation.create(
        [
          {
            user_id: req.user._id,
            sale_id: sale[0]._id,
            cost_id: costEntry._id,
            allocated_amount: allocationAmt,
            allocation_quantity: finalAllocationQty,
            unit_cost_at_allocation: costEntry.unit_cost,
          },
        ],
        { session }
      );
      allocationsCreated.push(allocation[0]);

      await CostEntry.findByIdAndUpdate(
        costEntry._id,
        {
          $inc: {
            allocated_amount: allocationAmt,
            allocated_quantity: finalAllocationQty,
          },
        },
        { session }
      );

      const updatedCost = await CostEntry.findById(costEntry._id).session(
        session
      );
      if (
        updatedCost.allocated_quantity >= updatedCost.quantity &&
        updatedCost.status !== "fully_allocated"
      ) {
        await CostEntry.findByIdAndUpdate(
          costEntry._id,
          { status: "fully_allocated" },
          { session }
        );
      }
    }

    if (new_cost_allocation) {
      const costTotal =
        new_cost_allocation.quantity * new_cost_allocation.unit_cost;
      const allocationQty = new_cost_allocation.allocation_quantity || 1;
      let allocationAmt = new_cost_allocation.allocation_amount;

      if (!allocationAmt) {
        allocationAmt = allocationQty * new_cost_allocation.unit_cost;
      }

      const newCostEntry = await CostEntry.create(
        [
          {
            user_id: req.user._id,
            description: new_cost_allocation.description.trim(),
            quantity: new_cost_allocation.quantity,
            unit_cost: new_cost_allocation.unit_cost,
            total_cost: costTotal,
            allocated_amount: allocationAmt,
            allocated_quantity: allocationQty,
            currency: new_cost_allocation.currency || "BDT",
            date: new_cost_allocation.date
              ? new Date(new_cost_allocation.date)
              : new Date(),
            status:
              allocationQty >= new_cost_allocation.quantity
                ? "fully_allocated"
                : "active",
          },
        ],
        { session }
      );
      newCostsCreated.push(newCostEntry[0]);

      const allocation = await Allocation.create(
        [
          {
            user_id: req.user._id,
            sale_id: sale[0]._id,
            cost_id: newCostEntry[0]._id,
            allocated_amount: allocationAmt,
            allocation_quantity: allocationQty,
            unit_cost_at_allocation: new_cost_allocation.unit_cost,
          },
        ],
        { session }
      );
      allocationsCreated.push(allocation[0]);
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      sale: {
        id: sale[0]._id.toString(),
        user_id: sale[0].user_id.toString(),
        product_name: sale[0].product_name,
        quantity: sale[0].quantity,
        sale_total: sale[0].sale_total,
        currency: sale[0].currency,
        payment_method: sale[0].payment_method,
        bank_id: sale[0].bank_id,
        bank_name: sale[0].bank_name,
        cash_holder: sale[0].cash_holder,
        date: sale[0].date,
        status: sale[0].status,
        created_at: sale[0].created_at,
      },
      allocations_created: allocationsCreated.map((a) => ({
        id: a._id.toString(),
        sale_id: a.sale_id.toString(),
        cost_id: a.cost_id?.toString() || null,
        allocated_amount: a.allocated_amount,
        allocation_quantity: a.allocation_quantity,
      })),
      new_costs_created: newCostsCreated.map((c) => ({
        id: c._id.toString(),
        description: c.description,
        quantity: c.quantity,
        unit_cost: c.unit_cost,
        total_cost: c.total_cost,
        allocated_amount: c.allocated_amount,
        allocated_quantity: c.allocated_quantity,
      })),
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const listSales = asyncHandlers(async (req, res) => {
  const {
    page = 1,
    per_page = 10,
    sort_by = "date_desc",
    from,
    to,
    payment_method,
    q,
  } = req.query;

  const finalLimit = parseInt(per_page) || 10;
  const finalOffset = (parseInt(page) - 1) * finalLimit;

  const filter = { status: { $ne: "deleted" } };

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  if (payment_method) {
    if (!["cash", "bank"].includes(payment_method)) {
      throw new ApiErrors(400, "Invalid payment method");
    }
    filter.payment_method = payment_method;
  }

  if (q) {
    filter.$or = [{ product_name: { $regex: q, $options: "i" } }];
  }

  let sort = { date: -1 };
  if (sort_by === "date_asc") sort = { date: 1 };
  if (sort_by === "amount_desc") sort = { sale_total: -1 };
  if (sort_by === "amount_asc") sort = { sale_total: 1 };

  const total = await Sale.countDocuments(filter);

  const sales = await Sale.find(filter)
    .sort(sort)
    .skip(finalOffset)
    .limit(finalLimit);

  const formattedSales = sales.map((sale) => ({
    id: sale._id.toString(),
    user_id: sale.user_id.toString(),
    product_name: sale.product_name,
    quantity: sale.quantity,
    sale_total: sale.sale_total,
    currency: sale.currency,
    payment_method: sale.payment_method,
    bank_id: sale.bank_id,
    bank_name: sale.bank_name,
    cash_holder: sale.cash_holder,
    date: sale.date,
    status: sale.status,
    created_at: sale.created_at,
  }));

  res.status(200).json({
    data: formattedSales,
    meta: {
      total,
      page: parseInt(page),
      per_page: finalLimit,
    },
  });
});

export const getSaleDetail = asyncHandlers(async (req, res) => {
  const { sale_id } = req.params;

  const sale = await Sale.findOne({ _id: sale_id });

  if (!sale) {
    throw new ApiErrors(404, "Sale not found");
  }

  const allocations = await Allocation.find({
    sale_id: sale._id,
  });

  const allocated_cost_total = allocations.reduce(
    (sum, a) => sum + a.allocated_amount,
    0
  );
  const profit = sale.sale_total - allocated_cost_total;
  const profit_margin =
    sale.sale_total > 0 ? (profit / sale.sale_total) * 100 : 0;

  res.status(200).json({
    sale: {
      id: sale._id.toString(),
      user_id: sale.user_id.toString(),
      product_name: sale.product_name,
      quantity: sale.quantity,
      sale_total: sale.sale_total,
      currency: sale.currency,
      payment_method: sale.payment_method,
      bank_id: sale.bank_id,
      bank_name: sale.bank_name,
      cash_holder: sale.cash_holder,
      date: sale.date,
      status: sale.status,
      created_at: sale.created_at,
      updated_at: sale.updated_at,
    },
    allocations: allocations.map((a) => ({
      id: a._id.toString(),
      cost_id: a.cost_id.toString(),
      allocated_amount: a.allocated_amount,
      created_at: a.created_at,
    })),
    allocated_cost_total,
    profit,
    profit_margin: parseFloat(profit_margin.toFixed(2)),
  });
});

export const refundSale = asyncHandlers(async (req, res) => {
  const { sale_id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(sale_id)) {
    throw new ApiErrors(400, "Invalid sale ID format");
  }

  const sale = await Sale.findOne({ _id: sale_id, user_id: req.user._id });

  if (!sale) {
    throw new ApiErrors(404, "Sale not found");
  }

  if (sale.status === "refunded") {
    throw new ApiErrors(400, "Sale has already been refunded");
  }

  if (sale.status !== "completed") {
    throw new ApiErrors(400, "Only completed sales can be refunded");
  }

  const allocations = await Allocation.find({
    sale_id: sale._id,
    user_id: req.user._id,
    is_reversed: false,
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const allocation of allocations) {
      await Allocation.findByIdAndUpdate(
        allocation._id,
        { is_reversed: true, reversed_at: new Date() },
        { session }
      );

      await CostEntry.findByIdAndUpdate(
        allocation.cost_id,
        { $inc: { allocated_amount: -allocation.allocated_amount } },
        { session }
      );
    }

    await Sale.findByIdAndUpdate(sale_id, { status: "refunded" }, { session });

    await session.commitTransaction();
    session.endSession();

    const updatedSale = await Sale.findById(sale_id);

    res.status(200).json({
      sale: {
        id: updatedSale._id.toString(),
        user_id: updatedSale.user_id.toString(),
        product_name: updatedSale.product_name,
        quantity: updatedSale.quantity,
        sale_total: updatedSale.sale_total,
        currency: updatedSale.currency,
        payment_method: updatedSale.payment_method,
        status: updatedSale.status,
        date: updatedSale.date,
        created_at: updatedSale.created_at,
        updated_at: updatedSale.updated_at,
      },
      allocations_reversed: allocations.length,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const deleteSale = asyncHandlers(async (req, res) => {
  const { sale_id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(sale_id)) {
    throw new ApiErrors(400, "Invalid sale ID format");
  }

  const sale = await Sale.findOne({ _id: sale_id, user_id: req.user._id });

  if (!sale) {
    throw new ApiErrors(404, "Sale not found");
  }

  const allocations = await Allocation.find({
    sale_id: sale._id,
    user_id: req.user._id,
    is_reversed: false,
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const auditLogs = [];
    const deletedAt = new Date();

    for (const allocation of allocations) {
      auditLogs.push({
        allocation_id: allocation._id.toString(),
        cost_id: allocation.cost_id?.toString(),
        allocated_amount: allocation.allocated_amount,
        allocation_quantity: allocation.allocation_quantity,
        reversed_at: deletedAt,
      });

      await Allocation.findByIdAndUpdate(
        allocation._id,
        { is_reversed: true, reversed_at: deletedAt, reversal_reason: "sale_deleted" },
        { session }
      );

      if (allocation.cost_id) {
        await CostEntry.findByIdAndUpdate(
          allocation.cost_id,
          { 
            $inc: { 
              allocated_amount: -allocation.allocated_amount,
              allocated_quantity: -allocation.allocation_quantity 
            }
          },
          { session }
        );
      }
    }

    await Sale.findByIdAndUpdate(sale_id, { 
      status: "deleted",
      deleted_at: deletedAt,
      deleted_by: req.user._id,
      audit_log: {
        deleted_at: deletedAt,
        allocations_reversed: allocations.length,
        reversed_allocation_details: auditLogs,
      }
    }, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
      deleted_sale: {
        id: sale._id.toString(),
        product_name: sale.product_name,
        sale_total: sale.sale_total,
        deleted_at: deletedAt,
      },
      allocations_reversed: allocations.length,
      audit_log: auditLogs,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const listDeletedSales = asyncHandlers(async (req, res) => {
  const { page = 1, per_page = 20 } = req.query;

  const finalLimit = parseInt(per_page) || 20;
  const finalOffset = (parseInt(page) - 1) * finalLimit;

  const filter = { status: "deleted", user_id: req.user._id };

  const total = await Sale.countDocuments(filter);

  const sales = await Sale.find(filter)
    .sort({ deleted_at: -1 })
    .skip(finalOffset)
    .limit(finalLimit)
    .populate("deleted_by", "name email");

  const formattedSales = sales.map((sale) => {
    const deletedBy = sale.deleted_by
      ? {
          id: sale.deleted_by._id.toString(),
          name: sale.deleted_by.name,
          email: sale.deleted_by.email,
        }
      : null;

    return {
      id: sale._id.toString(),
      product_name: sale.product_name,
      quantity: sale.quantity,
      sale_total: sale.sale_total,
      currency: sale.currency,
      payment_method: sale.payment_method,
      bank_name: sale.bank_name,
      cash_holder: sale.cash_holder,
      date: sale.date,
      deleted_at: sale.deleted_at,
      deleted_by: deletedBy,
      audit_log: sale.audit_log || [],
    };
  });

  res.status(200).json({
    data: formattedSales,
    meta: {
      total,
      page: parseInt(page),
      per_page: finalLimit,
    },
  });
});
