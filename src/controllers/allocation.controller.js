import Allocation from "../models/allocation.model.js";
import Sale from "../models/sale.model.js";
import CostEntry from "../models/costEntry.model.js";
import CostTemplate from "../models/costTemplate.model.js";
import mongoose from "mongoose";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";

export const createAllocation = asyncHandlers(async (req, res) => {
  const { sale_id, cost_id, cost_template_id, allocated_amount } = req.body;

  const errors = [];

  if (!sale_id) {
    errors.push({ field: "sale_id", message: "Sale ID is required" });
  } else if (!mongoose.Types.ObjectId.isValid(sale_id)) {
    errors.push({ field: "sale_id", message: "Invalid Sale ID format" });
  }

  if (!cost_id && !cost_template_id) {
    errors.push({
      field: "cost",
      message: "Either cost_id or cost_template_id is required",
    });
  }

  if (cost_id && cost_template_id) {
    errors.push({
      field: "cost",
      message: "Cannot specify both cost_id and cost_template_id",
    });
  }

  if (cost_id && !mongoose.Types.ObjectId.isValid(cost_id)) {
    errors.push({ field: "cost_id", message: "Invalid cost ID format" });
  }

  if (cost_template_id && !mongoose.Types.ObjectId.isValid(cost_template_id)) {
    errors.push({
      field: "cost_template_id",
      message: "Invalid cost template ID format",
    });
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

  let costEntry = null;
  let costTemplate = null;

  if (cost_id) {
    costEntry = await CostEntry.findOne({
      _id: cost_id,
      user_id: req.user._id,
    });
    if (!costEntry) {
      throw new ApiErrors(
        404,
        "Cost entry not found or does not belong to user"
      );
    }

    const remainingAmount = costEntry.total_cost - costEntry.allocated_amount;
    if (allocated_amount > remainingAmount) {
      throw new ApiErrors(
        400,
        `Allocated amount exceeds remaining unallocated amount. Maximum allowed: ${remainingAmount}`
      );
    }
  }

  if (cost_template_id) {
    costTemplate = await CostTemplate.findOne({
      _id: cost_template_id,
      user_id: req.user._id,
    });
    if (!costTemplate) {
      throw new ApiErrors(
        404,
        "Cost template not found or does not belong to user"
      );
    }
    if (!costTemplate.is_active) {
      throw new ApiErrors(400, "Cost template is inactive");
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const allocationData = {
      user_id: req.user._id,
      sale_id,
      allocated_amount,
    };

    if (cost_id) {
      allocationData.cost_id = cost_id;
    } else {
      allocationData.cost_template_id = cost_template_id;
    }

    const allocation = await Allocation.create([allocationData], { session });

    if (costEntry) {
      await CostEntry.findByIdAndUpdate(
        cost_id,
        {
          $inc: { allocated_amount: allocated_amount },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    const responseData = {
      allocation: {
        id: allocation[0]._id.toString(),
        user_id: allocation[0].user_id.toString(),
        sale_id: allocation[0].sale_id.toString(),
        cost_id: allocation[0].cost_id?.toString() || null,
        cost_template_id: allocation[0].cost_template_id?.toString() || null,
        allocated_amount: allocation[0].allocated_amount,
        created_at: allocation[0].created_at,
      },
    };

    const allocations = await Allocation.find({
      sale_id,
      user_id: req.user._id,
    });
    const totalAllocatedCost = allocations.reduce(
      (sum, a) => sum + a.allocated_amount,
      0
    );

    responseData.sale_summary = {
      sale_id: sale._id.toString(),
      total_allocated_cost: totalAllocatedCost,
    };

    if (costEntry) {
      const updatedCostEntry = await CostEntry.findById(cost_id);
      responseData.cost_entry_summary = {
        cost_id: costEntry._id.toString(),
        total_cost: costEntry.total_cost,
        allocated_amount: updatedCostEntry.allocated_amount,
        remaining_unallocated_cost:
          costEntry.total_cost - updatedCostEntry.allocated_amount,
      };
    }

    if (costTemplate) {
      responseData.cost_template_summary = {
        cost_template_id: costTemplate._id.toString(),
        name: costTemplate.name,
        unit_cost: costTemplate.unit_cost,
      };
    }

    res.status(201).json(responseData);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
