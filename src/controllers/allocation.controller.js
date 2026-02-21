import Allocation from "../models/allocation.model.js";
import Sale from "../models/sale.model.js";
import CostEntry from "../models/costEntry.model.js";
import mongoose from "mongoose";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";

export const createAllocation = asyncHandlers(async (req, res) => {
  const { sale_id, cost_id, allocated_amount } = req.body;

  const errors = [];

  if (!sale_id) {
    errors.push({ field: "sale_id", message: "Sale ID is required" });
  } else if (!mongoose.Types.ObjectId.isValid(sale_id)) {
    errors.push({ field: "sale_id", message: "Invalid Sale ID format" });
  }

  if (!cost_id) {
    errors.push({ field: "cost_id", message: "Cost ID is required" });
  } else if (!mongoose.Types.ObjectId.isValid(cost_id)) {
    errors.push({ field: "cost_id", message: "Invalid Cost ID format" });
  }

  if (allocated_amount === undefined || allocated_amount === null) {
    errors.push({
      field: "allocated_amount",
      message: "Allocated amount is required",
    });
  } else if (typeof allocated_amount !== "number" || allocated_amount <= 0) {
    errors.push({
      field: "allocated_amount",
      message: "Allocated amount must be a positive number",
    });
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation failed", errors);
  }

  const sale = await Sale.findOne({ _id: sale_id, user_id: req.user._id });
  if (!sale) {
    throw new ApiErrors(404, "Sale not found or does not belong to user");
  }

  const costEntry = await CostEntry.findOne({
    _id: cost_id,
    user_id: req.user._id,
  });
  if (!costEntry) {
    throw new ApiErrors(404, "Cost entry not found or does not belong to user");
  }

  const remainingAmount = costEntry.total_cost - costEntry.allocated_amount;
  if (allocated_amount > remainingAmount) {
    throw new ApiErrors(
      400,
      `Allocated amount exceeds remaining unallocated amount. Maximum allowed: ${remainingAmount}`
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const allocation = await Allocation.create(
      [
        {
          user_id: req.user._id,
          sale_id,
          cost_id,
          allocated_amount,
        },
      ],
      { session }
    );

    await CostEntry.findByIdAndUpdate(
      cost_id,
      {
        $inc: { allocated_amount: allocated_amount },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const updatedCostEntry = await CostEntry.findById(cost_id);

    const allocations = await Allocation.find({
      sale_id,
      user_id: req.user._id,
    });
    const totalAllocatedCost = allocations.reduce(
      (sum, a) => sum + a.allocated_amount,
      0
    );

    res.status(201).json({
      allocation: {
        id: allocation[0]._id.toString(),
        user_id: allocation[0].user_id.toString(),
        sale_id: allocation[0].sale_id.toString(),
        cost_id: allocation[0].cost_id.toString(),
        allocated_amount: allocation[0].allocated_amount,
        created_at: allocation[0].created_at,
      },
      sale_summary: {
        sale_id: sale._id.toString(),
        total_allocated_cost: totalAllocatedCost,
      },
      cost_entry_summary: {
        cost_id: costEntry._id.toString(),
        total_cost: costEntry.total_cost,
        allocated_amount: updatedCostEntry.allocated_amount,
        remaining_unallocated_cost:
          updatedCostEntry.total_cost - updatedCostEntry.allocated_amount,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
