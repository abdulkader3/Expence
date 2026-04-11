import CostEntry from "../models/costEntry.model.js";
import Allocation from "../models/allocation.model.js";
import Sale from "../models/sale.model.js";
import User from "../models/user.model.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import mongoose from "mongoose";

export const createCostEntry = asyncHandlers(async (req, res) => {
  const { description, quantity, unit_cost, total_cost, currency, date } =
    req.body;

  const errors = [];

  if (
    !description ||
    typeof description !== "string" ||
    description.trim().length === 0
  ) {
    errors.push({
      field: "description",
      message: "Description is required",
    });
  }

  if (quantity === undefined || quantity === null) {
    errors.push({
      field: "quantity",
      message: "Quantity is required",
    });
  } else if (typeof quantity !== "number" || quantity < 1) {
    errors.push({
      field: "quantity",
      message: "Quantity must be a number greater than or equal to 1",
    });
  }

  if (unit_cost === undefined || unit_cost === null) {
    errors.push({
      field: "unit_cost",
      message: "Unit cost is required",
    });
  } else if (typeof unit_cost !== "number" || unit_cost < 0) {
    errors.push({
      field: "unit_cost",
      message: "Unit cost must be a positive number",
    });
  }

  if (total_cost !== undefined && total_cost !== null) {
    if (typeof total_cost !== "number" || total_cost <= 0) {
      errors.push({
        field: "total_cost",
        message: "Total cost must be a positive number",
      });
    }
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation failed", errors);
  }

  const calculatedTotal = quantity * unit_cost;
  const finalTotal = total_cost ?? calculatedTotal;

  const costEntry = await CostEntry.create({
    user_id: req.user._id,
    description: description.trim(),
    quantity,
    unit_cost,
    total_cost: finalTotal,
    allocated_amount: 0,
    allocated_quantity: 0,
    currency: currency || "BDT",
    date: date ? new Date(date) : new Date(),
    status: "active",
  });

  res.status(201).json({
    cost_entry: {
      id: costEntry._id.toString(),
      user_id: costEntry.user_id.toString(),
      description: costEntry.description,
      quantity: costEntry.quantity,
      unit_cost: costEntry.unit_cost,
      total_cost: costEntry.total_cost,
      allocated_amount: costEntry.allocated_amount,
      allocated_quantity: costEntry.allocated_quantity,
      remaining_amount: costEntry.total_cost - costEntry.allocated_amount,
      remaining_quantity: costEntry.quantity - costEntry.allocated_quantity,
      currency: costEntry.currency,
      date: costEntry.date,
      status: costEntry.status,
      created_at: costEntry.created_at,
    },
  });
});

export const listCostEntries = asyncHandlers(async (req, res) => {
  const { page = 1, per_page = 10, from, to, status, q } = req.query;

  const finalLimit = parseInt(per_page) || 10;
  const finalOffset = (parseInt(page) - 1) * finalLimit;

  const filter = { status: { $ne: "deleted" } };

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  if (status) {
    const validStatuses = ["active", "fully_allocated", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new ApiErrors(400, "Invalid status value");
    }
    filter.status = status;
  }

  if (q) {
    filter.$or = [{ description: { $regex: q, $options: "i" } }];
  }

  const total = await CostEntry.countDocuments(filter);

  const costEntries = await CostEntry.find(filter)
    .sort({ date: -1 })
    .skip(finalOffset)
    .limit(finalLimit);

  const formattedCostEntries = costEntries.map((entry) => ({
    id: entry._id.toString(),
    user_id: entry.user_id.toString(),
    description: entry.description,
    quantity: entry.quantity,
    unit_cost: entry.unit_cost,
    total_cost: entry.total_cost,
    allocated_amount: entry.allocated_amount,
    allocated_quantity: entry.allocated_quantity,
    remaining_amount: entry.total_cost - entry.allocated_amount,
    remaining_quantity: entry.quantity - entry.allocated_quantity,
    currency: entry.currency,
    date: entry.date,
    status: entry.status,
    created_at: entry.created_at,
  }));

  res.status(200).json({
    data: formattedCostEntries,
    meta: {
      total,
      page: parseInt(page),
      per_page: finalLimit,
    },
  });
});

export const getCostEntryDetail = asyncHandlers(async (req, res) => {
  const { cost_id } = req.params;

  const costEntry = await CostEntry.findOne({
    _id: cost_id,
  });

  if (!costEntry) {
    throw new ApiErrors(404, "Cost entry not found");
  }

  res.status(200).json({
    cost_entry: {
      id: costEntry._id.toString(),
      user_id: costEntry.user_id.toString(),
      description: costEntry.description,
      quantity: costEntry.quantity,
      unit_cost: costEntry.unit_cost,
      total_cost: costEntry.total_cost,
      allocated_amount: costEntry.allocated_amount,
      allocated_quantity: costEntry.allocated_quantity,
      remaining_amount: costEntry.total_cost - costEntry.allocated_amount,
      remaining_quantity: costEntry.quantity - costEntry.allocated_quantity,
      currency: costEntry.currency,
      date: costEntry.date,
      status: costEntry.status,
      created_at: costEntry.created_at,
      updated_at: costEntry.updated_at,
    },
  });
});

export const deleteCostEntry = asyncHandlers(async (req, res) => {
  const { cost_id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(cost_id)) {
    throw new ApiErrors(400, "Invalid cost entry ID format");
  }

  const costEntry = await CostEntry.findOne({
    _id: cost_id,
    user_id: req.user._id,
  });

  if (!costEntry) {
    throw new ApiErrors(404, "Cost entry not found");
  }

  const allocations = await Allocation.find({
    cost_id: costEntry._id,
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
        sale_id: allocation.sale_id?.toString(),
        allocated_amount: allocation.allocated_amount,
        allocation_quantity: allocation.allocation_quantity,
        reversed_at: deletedAt,
      });

      await Allocation.findByIdAndUpdate(
        allocation._id,
        { is_reversed: true, reversed_at: deletedAt, reversal_reason: "cost_deleted" },
        { session }
      );

      await Sale.findByIdAndUpdate(
        allocation.sale_id,
        { 
          $set: { status: "deleted_allocation" },
          $push: { 
            audit_log: {
              event: "allocation_reversed_on_cost_deletion",
              allocation_id: allocation._id,
              cost_id: costEntry._id,
              allocated_amount: allocation.allocated_amount,
              reversed_at: deletedAt,
            }
          }
        },
        { session }
      );
    }

    await CostEntry.findByIdAndUpdate(cost_id, { 
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
      message: "Cost entry deleted successfully",
      deleted_cost_entry: {
        id: costEntry._id.toString(),
        description: costEntry.description,
        total_cost: costEntry.total_cost,
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

export const listDeletedCostEntries = asyncHandlers(async (req, res) => {
  const { page = 1, per_page = 20 } = req.query;

  const finalLimit = parseInt(per_page) || 20;
  const finalOffset = (parseInt(page) - 1) * finalLimit;

  const filter = { status: "deleted", user_id: req.user._id };

  const total = await CostEntry.countDocuments(filter);

  const costEntries = await CostEntry.find(filter)
    .sort({ deleted_at: -1 })
    .skip(finalOffset)
    .limit(finalLimit)
    .populate("deleted_by", "name email");

  const formattedCostEntries = costEntries.map((entry) => {
    const deletedBy = entry.deleted_by
      ? {
          id: entry.deleted_by._id.toString(),
          name: entry.deleted_by.name,
          email: entry.deleted_by.email,
        }
      : null;

    return {
      id: entry._id.toString(),
      description: entry.description,
      quantity: entry.quantity,
      unit_cost: entry.unit_cost,
      total_cost: entry.total_cost,
      allocated_amount: entry.allocated_amount,
      allocated_quantity: entry.allocated_quantity,
      currency: entry.currency,
      date: entry.date,
      deleted_at: entry.deleted_at,
      deleted_by: deletedBy,
      audit_log: entry.audit_log || [],
    };
  });

  res.status(200).json({
    data: formattedCostEntries,
    meta: {
      total,
      page: parseInt(page),
      per_page: finalLimit,
    },
  });
});
