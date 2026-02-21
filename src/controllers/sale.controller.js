import Sale from "../models/sale.model.js";
import Allocation from "../models/allocation.model.js";
import CostEntry from "../models/costEntry.model.js";
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
    if (!bank_id && !bank_name) {
      errors.push({
        field: "bank_id/bank_name",
        message: "Bank ID or Bank name is required when payment method is bank",
      });
    }
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation failed", errors);
  }

  const sale = await Sale.create({
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
  });

  res.status(201).json({
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
    },
  });
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

  const filter = { user_id: req.user._id };

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

  const sale = await Sale.findOne({ _id: sale_id, user_id: req.user._id });

  if (!sale) {
    throw new ApiErrors(404, "Sale not found");
  }

  const allocations = await Allocation.find({
    sale_id: sale._id,
    user_id: req.user._id,
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
