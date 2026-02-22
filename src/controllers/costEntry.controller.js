import CostEntry from "../models/costEntry.model.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";

export const createCostEntry = asyncHandlers(async (req, res) => {
  const { description, total_cost, currency, date } = req.body;

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

  if (total_cost === undefined || total_cost === null) {
    errors.push({
      field: "total_cost",
      message: "Total cost is required",
    });
  } else if (typeof total_cost !== "number" || total_cost <= 0) {
    errors.push({
      field: "total_cost",
      message: "Total cost must be a positive number",
    });
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation failed", errors);
  }

  const costEntry = await CostEntry.create({
    user_id: req.user._id,
    description: description.trim(),
    total_cost,
    allocated_amount: 0,
    currency: currency || "BDT",
    date: date ? new Date(date) : new Date(),
    status: "active",
  });

  res.status(201).json({
    cost_entry: {
      id: costEntry._id.toString(),
      user_id: costEntry.user_id.toString(),
      description: costEntry.description,
      total_cost: costEntry.total_cost,
      allocated_amount: costEntry.allocated_amount,
      remaining_amount: costEntry.total_cost - costEntry.allocated_amount,
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

  const filter = {};

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
    total_cost: entry.total_cost,
    allocated_amount: entry.allocated_amount,
    remaining_amount: entry.total_cost - entry.allocated_amount,
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
      total_cost: costEntry.total_cost,
      allocated_amount: costEntry.allocated_amount,
      remaining_amount: costEntry.total_cost - costEntry.allocated_amount,
      currency: costEntry.currency,
      date: costEntry.date,
      status: costEntry.status,
      created_at: costEntry.created_at,
      updated_at: costEntry.updated_at,
    },
  });
});
