import Allocation from "../models/allocation.model.js";
import Sale from "../models/sale.model.js";
import CostEntry from "../models/costEntry.model.js";
import CostTemplate from "../models/costTemplate.model.js";
import mongoose from "mongoose";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";

const DEBUG = process.env.NODE_ENV !== "production";

const debugLog = (message, data) => {
  if (DEBUG) {
    console.log(
      `[DEBUG][ALLOCATION] ${new Date().toISOString()} - ${message}`,
      data ? JSON.stringify(data, null, 2) : ""
    );
  }
};

const debugError = (message, error) => {
  if (DEBUG) {
    console.error(
      `[DEBUG][ALLOCATION][ERROR] ${new Date().toISOString()} - ${message}`,
      error.message || error
    );
  }
};

export const createAllocation = asyncHandlers(async (req, res) => {
  const {
    sale_id,
    cost_id,
    cost_template_id,
    allocated_amount,
    allocation_quantity,
    unit_cost,
  } = req.body;

  debugLog("Incoming allocation request", {
    user_id: req.user._id,
    sale_id,
    cost_id,
    cost_template_id,
    allocated_amount,
    allocation_quantity,
    unit_cost,
  });

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

  if (
    allocation_quantity !== undefined &&
    allocation_quantity !== null &&
    (typeof allocation_quantity !== "number" || allocation_quantity < 1)
  ) {
    errors.push({
      field: "allocation_quantity",
      message: "Allocation quantity must be a positive number",
    });
  }

  if (errors.length > 0) {
    debugError("Validation failed", errors);
    throw new ApiErrors(400, "Validation failed", errors);
  }

  debugLog("Validation passed, fetching sale and cost entry");

  const sale = await Sale.findOne({ _id: sale_id, user_id: req.user._id });
  if (!sale) {
    throw new ApiErrors(404, "Sale not found or does not belong to user");
  }

  let costEntry = null;
  let costTemplate = null;
  let finalAllocationQuantity = allocation_quantity || 1;
  let finalAllocatedAmount = allocated_amount;

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

    debugLog("Cost entry found before allocation", {
      cost_id: costEntry._id,
      quantity: costEntry.quantity,
      unit_cost: costEntry.unit_cost,
      total_cost: costEntry.total_cost,
      allocated_quantity: costEntry.allocated_quantity,
      allocated_amount: costEntry.allocated_amount,
      remaining_quantity: costEntry.quantity - costEntry.allocated_quantity,
      remaining_amount: costEntry.total_cost - costEntry.allocated_amount,
    });

    const remainingQuantity =
      costEntry.quantity - (costEntry.allocated_quantity || 0);
    const remainingAmount =
      costEntry.total_cost - (costEntry.allocated_amount || 0);

    if (finalAllocationQuantity > remainingQuantity) {
      debugError("Allocation quantity exceeds remaining quantity", {
        requested: finalAllocationQuantity,
        remaining: remainingQuantity,
      });
      throw new ApiErrors(
        400,
        `Allocation quantity exceeds remaining quantity. Maximum allowed: ${remainingQuantity}`
      );
    }

    if (finalAllocatedAmount > remainingAmount) {
      debugError("Allocation amount exceeds remaining amount", {
        requested: finalAllocatedAmount,
        remaining: remainingAmount,
      });
      throw new ApiErrors(
        400,
        `Allocated amount exceeds remaining unallocated amount. Maximum allowed: ${remainingAmount}`
      );
    }

    if (!allocation_quantity && costEntry.unit_cost) {
      finalAllocationQuantity = Math.ceil(
        remainingAmount / costEntry.unit_cost
      );
      finalAllocatedAmount = finalAllocationQuantity * costEntry.unit_cost;
      if (finalAllocationQuantity > remainingQuantity) {
        finalAllocationQuantity = remainingQuantity;
        finalAllocatedAmount = remainingAmount;
      }
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
    debugLog("Starting transaction, creating allocation record");

    const allocationData = {
      user_id: req.user._id,
      sale_id,
      allocated_amount: finalAllocatedAmount,
      allocation_quantity: finalAllocationQuantity,
    };

    if (cost_id) {
      allocationData.cost_id = cost_id;
      allocationData.unit_cost_at_allocation = costEntry.unit_cost;
    } else {
      allocationData.cost_template_id = cost_template_id;
      if (unit_cost) {
        allocationData.unit_cost_at_allocation = unit_cost;
      }
    }

    const allocation = await Allocation.create([allocationData], { session });

    debugLog("Allocation created", { allocation_id: allocation[0]._id });

    if (costEntry) {
      debugLog("Updating cost entry with $inc", {
        cost_id,
        allocated_amount: finalAllocatedAmount,
        allocated_quantity: finalAllocationQuantity,
      });

      await CostEntry.findByIdAndUpdate(
        cost_id,
        {
          $inc: {
            allocated_amount: finalAllocatedAmount,
            allocated_quantity: finalAllocationQuantity,
          },
        },
        { session }
      );

      debugLog("Fetching updated cost entry after $inc");

      const costEntryAfterUpdate =
        await CostEntry.findById(cost_id).session(session);

      debugLog("Cost entry after allocation", {
        cost_id: costEntryAfterUpdate._id,
        quantity: costEntryAfterUpdate.quantity,
        unit_cost: costEntryAfterUpdate.unit_cost,
        total_cost: costEntryAfterUpdate.total_cost,
        allocated_quantity: costEntryAfterUpdate.allocated_quantity,
        allocated_amount: costEntryAfterUpdate.allocated_amount,
        remaining_quantity:
          costEntryAfterUpdate.quantity -
          costEntryAfterUpdate.allocated_quantity,
        remaining_amount:
          costEntryAfterUpdate.total_cost -
          costEntryAfterUpdate.allocated_amount,
        current_status: costEntryAfterUpdate.status,
      });

      const remainingAfterAllocation =
        costEntryAfterUpdate.quantity - costEntryAfterUpdate.allocated_quantity;

      if (
        remainingAfterAllocation <= 0 &&
        costEntryAfterUpdate.status !== "fully_allocated"
      ) {
        debugLog(
          "Cost is now fully allocated, updating status to 'fully_allocated'"
        );

        await CostEntry.findByIdAndUpdate(
          cost_id,
          { status: "fully_allocated" },
          { session }
        );

        debugLog("Status updated to 'fully_allocated'");
      }
    }

    await session.commitTransaction();
    session.endSession();

    debugLog("Transaction committed successfully");

    const responseData = {
      allocation: {
        id: allocation[0]._id.toString(),
        user_id: allocation[0].user_id.toString(),
        sale_id: allocation[0].sale_id.toString(),
        cost_id: allocation[0].cost_id?.toString() || null,
        cost_template_id: allocation[0].cost_template_id?.toString() || null,
        allocated_amount: allocation[0].allocated_amount,
        allocation_quantity: allocation[0].allocation_quantity,
        unit_cost_at_allocation: allocation[0].unit_cost_at_allocation,
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
        quantity: costEntry.quantity,
        unit_cost: costEntry.unit_cost,
        total_cost: costEntry.total_cost,
        allocated_quantity: updatedCostEntry.allocated_quantity,
        allocated_amount: updatedCostEntry.allocated_amount,
        remaining_quantity:
          costEntry.quantity - updatedCostEntry.allocated_quantity,
        remaining_unallocated_cost:
          costEntry.total_cost - updatedCostEntry.allocated_amount,
        status: updatedCostEntry.status,
      };

      debugLog(
        "Final cost_entry_summary in response",
        responseData.cost_entry_summary
      );
    }

    if (costTemplate) {
      responseData.cost_template_summary = {
        cost_template_id: costTemplate._id.toString(),
        name: costTemplate.name,
        unit_cost: costTemplate.unit_cost,
      };
    }

    debugLog("Sending successful response", responseData);

    res.status(201).json(responseData);
  } catch (error) {
    debugError("Transaction failed, aborting", error);
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
