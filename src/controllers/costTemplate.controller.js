import CostTemplate from "../models/costTemplate.model.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";

export const createCostTemplate = asyncHandlers(async (req, res) => {
  const { name, unit_cost, description, category, currency } = req.body;

  const errors = [];

  if (!name || name.trim() === "") {
    errors.push({ field: "name", message: "Template name is required" });
  }

  if (unit_cost === undefined || unit_cost === null) {
    errors.push({ field: "unit_cost", message: "Unit cost is required" });
  } else if (typeof unit_cost !== "number" || unit_cost <= 0) {
    errors.push({
      field: "unit_cost",
      message: "Unit cost must be a positive number",
    });
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation failed", errors);
  }

  const costTemplate = await CostTemplate.create({
    user_id: req.user._id,
    name: name.trim(),
    unit_cost,
    description: description?.trim(),
    category: category?.trim(),
    currency: currency || "BDT",
  });

  res.status(201).json({
    cost_template: {
      id: costTemplate._id.toString(),
      name: costTemplate.name,
      unit_cost: costTemplate.unit_cost,
      description: costTemplate.description,
      category: costTemplate.category,
      currency: costTemplate.currency,
      is_active: costTemplate.is_active,
      created_at: costTemplate.created_at,
    },
  });
});

export const getCostTemplates = asyncHandlers(async (req, res) => {
  const { include_inactive, category } = req.query;

  const query = { user_id: req.user._id };

  if (include_inactive !== "true") {
    query.is_active = true;
  }

  if (category) {
    query.category = category;
  }

  const costTemplates = await CostTemplate.find(query).sort({ created_at: -1 });

  res.status(200).json({
    cost_templates: costTemplates.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      unit_cost: t.unit_cost,
      description: t.description,
      category: t.category,
      currency: t.currency,
      is_active: t.is_active,
      created_at: t.created_at,
    })),
  });
});

export const getCostTemplateById = asyncHandlers(async (req, res) => {
  const { id } = req.params;

  const costTemplate = await CostTemplate.findOne({
    _id: id,
    user_id: req.user._id,
  });

  if (!costTemplate) {
    throw new ApiErrors(404, "Cost template not found");
  }

  res.status(200).json({
    cost_template: {
      id: costTemplate._id.toString(),
      name: costTemplate.name,
      unit_cost: costTemplate.unit_cost,
      description: costTemplate.description,
      category: costTemplate.category,
      currency: costTemplate.currency,
      is_active: costTemplate.is_active,
      created_at: costTemplate.created_at,
    },
  });
});

export const updateCostTemplate = asyncHandlers(async (req, res) => {
  const { id } = req.params;
  const { name, unit_cost, description, category, currency, is_active } =
    req.body;

  const costTemplate = await CostTemplate.findOne({
    _id: id,
    user_id: req.user._id,
  });

  if (!costTemplate) {
    throw new ApiErrors(404, "Cost template not found");
  }

  if (name !== undefined) {
    if (!name || name.trim() === "") {
      throw new ApiErrors(400, "Name cannot be empty");
    }
    costTemplate.name = name.trim();
  }

  if (unit_cost !== undefined) {
    if (typeof unit_cost !== "number" || unit_cost <= 0) {
      throw new ApiErrors(400, "Unit cost must be a positive number");
    }
    costTemplate.unit_cost = unit_cost;
  }

  if (description !== undefined) {
    costTemplate.description = description?.trim() || "";
  }

  if (category !== undefined) {
    costTemplate.category = category?.trim() || "";
  }

  if (currency !== undefined) {
    costTemplate.currency = currency?.toUpperCase() || "BDT";
  }

  if (is_active !== undefined) {
    costTemplate.is_active = is_active;
  }

  await costTemplate.save();

  res.status(200).json({
    cost_template: {
      id: costTemplate._id.toString(),
      name: costTemplate.name,
      unit_cost: costTemplate.unit_cost,
      description: costTemplate.description,
      category: costTemplate.category,
      currency: costTemplate.currency,
      is_active: costTemplate.is_active,
      created_at: costTemplate.created_at,
    },
  });
});

export const deleteCostTemplate = asyncHandlers(async (req, res) => {
  const { id } = req.params;
  const { hard_delete } = req.query;

  const costTemplate = await CostTemplate.findOne({
    _id: id,
    user_id: req.user._id,
  });

  if (!costTemplate) {
    throw new ApiErrors(404, "Cost template not found");
  }

  if (hard_delete === "true") {
    await CostTemplate.findByIdAndDelete(id);
  } else {
    costTemplate.is_active = false;
    await costTemplate.save();
  }

  res.status(200).json({
    message:
      hard_delete === "true"
        ? "Cost template permanently deleted"
        : "Cost template deactivated",
  });
});
