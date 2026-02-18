import Partner from "../models/partner.model.js";
import Transaction from "../models/transaction.model.js";
import mongoose from "mongoose";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import { UploadOnCloudinary } from "../utils/Cloudinary.js";

export const listPartners = asyncHandlers(async (req, res) => {
  const {
    sort_by = "total_contributed",
    limit = 10,
    offset = 0,
    page = 1,
    per_page = 10,
    include_transactions = false,
  } = req.query;

  const finalLimit = parseInt(limit) || parseInt(per_page) || 10;
  const finalOffset = parseInt(offset) || (parseInt(page) - 1) * finalLimit;

  const validSortFields = ["total_contributed", "name", "created_at"];
  const sortField = validSortFields.includes(sort_by)
    ? sort_by
    : "total_contributed";

  const sortOrder = sortField === "total_contributed" ? -1 : 1;

  const pipeline = [];

  if (include_transactions === "true") {
    pipeline.push({
      $lookup: {
        from: "transactions",
        let: { partnerId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$partner_id", "$$partnerId"] },
              type: "contribution",
            },
          },
          { $sort: { created_at: -1 } },
          { $limit: 5 },
        ],
        as: "recent_transactions",
      },
    });
    pipeline.push({
      $addFields: {
        last_contribution_at: {
          $cond: {
            if: { $gt: [{ $size: "$recent_transactions" }, 0] },
            then: { $arrayElemAt: ["$recent_transactions.created_at", 0] },
            else: null,
          },
        },
      },
    });
  } else {
    pipeline.push({
      $lookup: {
        from: "transactions",
        localField: "_id",
        foreignField: "partner_id",
        pipeline: [
          { $match: { type: "contribution" } },
          { $sort: { created_at: -1 } },
          { $limit: 1 },
        ],
        as: "contrib_lookup",
      },
    });
    pipeline.push({
      $addFields: {
        last_contribution_at: {
          $cond: {
            if: { $gt: [{ $size: "$contrib_lookup" }, 0] },
            then: { $arrayElemAt: ["$contrib_lookup.created_at", 0] },
            else: null,
          },
        },
      },
    });
    pipeline.push({ $project: { contrib_lookup: 0 } });
  }

  pipeline.push({
    $sort: {
      [sortField]: sortOrder,
      last_contribution_at: -1,
    },
  });
  pipeline.push({ $skip: finalOffset });
  pipeline.push({ $limit: finalLimit });

  const partners = await Partner.aggregate(pipeline);

  const countPipeline = [{ $count: "total" }];
  const countResult = await Partner.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  const formattedPartners = partners.map((partner) => ({
    id: partner._id.toString(),
    name: partner.name,
    avatar_url: partner.avatar_url,
    total_contributed: partner.total_contributed,
    last_contribution_at: partner.last_contribution_at,
    ...(include_transactions === "true" && {
      recent_transactions: partner.recent_transactions.map((t) => ({
        id: t._id.toString(),
        amount: t.amount,
        type: t.type,
        description: t.description,
        created_at: t.created_at,
      })),
    }),
  }));

  res.status(200).json({
    data: formattedPartners,
    meta: {
      total,
      page: Math.floor(finalOffset / finalLimit) + 1,
      per_page: finalLimit,
    },
  });
});

export const getPartnerDetail = asyncHandlers(async (req, res) => {
  const { partner_id } = req.params;
  const { from, to, category, page = 1, per_page = 10, search } = req.query;

  const partner = await Partner.findById(partner_id);
  if (!partner) {
    throw new ApiErrors(404, "Partner not found");
  }

  const finalLimit = parseInt(per_page) || 10;
  const finalOffset = (parseInt(page) - 1) * finalLimit;

  const filter = { partner_id: partner._id };

  if (from || to) {
    filter.created_at = {};
    if (from) filter.created_at.$gte = new Date(from);
    if (to) filter.created_at.$lte = new Date(to);
  }

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$or = [
      { context: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const totalTransactions = await Transaction.countDocuments(filter);

  const transactions = await Transaction.find(filter)
    .sort({ created_at: -1 })
    .skip(finalOffset)
    .limit(finalLimit)
    .populate("recorded_by", "name email");

  const formattedTransactions = transactions.map((t) => ({
    id: t._id.toString(),
    type: t.type,
    amount: Math.abs(t.amount),
    category: t.category,
    context: t.context,
    recorded_by: t.recorded_by?._id?.toString(),
    date: t.created_at,
    receipt_url: t.receipt_url,
  }));

  res.status(200).json({
    partner: {
      id: partner._id.toString(),
      name: partner.name,
      avatar_url: partner.avatar_url,
      notes: partner.notes,
      total_contributed: partner.total_contributed,
    },
    transactions: formattedTransactions,
    meta: {
      total_transactions: totalTransactions,
    },
  });
});

export const createPartner = asyncHandlers(async (req, res) => {
  const { name, email, initial_contributed, notes } = req.body;

  const errors = [];

  if (!name || typeof name !== "string") {
    errors.push({ field: "name", message: "Name is required" });
  } else if (name.trim().length < 2) {
    errors.push({
      field: "name",
      message: "Name must be at least 2 characters",
    });
  } else if (name.trim().length > 100) {
    errors.push({
      field: "name",
      message: "Name cannot exceed 100 characters",
    });
  }

  if (email && typeof email !== "string") {
    errors.push({ field: "email", message: "Email must be a string" });
  } else if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push({ field: "email", message: "Please provide a valid email" });
  }

  if (initial_contributed !== undefined && initial_contributed !== null) {
    if (typeof initial_contributed !== "number" || initial_contributed < 0) {
      errors.push({
        field: "initial_contributed",
        message: "Initial contributed must be a non-negative number",
      });
    }
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation error", errors);
  }

  let avatar_url = null;
  if (req.file) {
    const cloudinaryResponse = await UploadOnCloudinary(req.file.path);
    if (cloudinaryResponse) {
      avatar_url = cloudinaryResponse.url;
    }
  }

  const partner = await Partner.create({
    name: name.trim(),
    email: email || null,
    avatar_url: avatar_url,
    notes: notes || null,
    total_contributed: 0,
  });

  if (
    initial_contributed !== undefined &&
    initial_contributed !== null &&
    initial_contributed > 0
  ) {
    await Transaction.create({
      partner_id: partner._id,
      amount: initial_contributed,
      type: "contribution",
      description: "Initial contribution",
      recorded_by: req.user._id,
    });

    partner.total_contributed = initial_contributed;
    await partner.save();
  }

  res.status(201).json({
    partner: {
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
      avatar_url: partner.avatar_url,
      notes: partner.notes,
      total_contributed: partner.total_contributed,
      created_at: partner.created_at,
    },
  });
});

export const createContribution = asyncHandlers(async (req, res) => {
  const idempotencyKey = req.header("Idempotency-Key");
  const {
    recorded_for,
    recorded_by,
    amount,
    currency,
    category,
    context,
    date,
    receipt_id,
  } = req.body;

  const errors = [];

  if (!recorded_for) {
    errors.push({ field: "recorded_for", message: "Partner ID is required" });
  }

  if (!amount || typeof amount !== "number" || amount <= 0) {
    errors.push({
      field: "amount",
      message: "Amount must be a positive number",
    });
  }

  if (recorded_for && !mongoose.Types.ObjectId.isValid(recorded_for)) {
    errors.push({
      field: "recorded_for",
      message: "Invalid partner ID format",
    });
  }

  if (errors.length > 0) {
    throw new ApiErrors(400, "Validation error", errors);
  }

  const partner = await Partner.findById(recorded_for);
  if (!partner) {
    throw new ApiErrors(404, "Partner not found");
  }

  if (idempotencyKey) {
    const existing = await Transaction.findOne({
      idempotency_key: idempotencyKey,
    });
    if (existing) {
      const updatedPartner = await Partner.findById(recorded_for);
      return res.status(409).json({
        success: false,
        message: "Duplicate idempotent request",
        errors: [],
        data: {
          transaction: {
            id: existing._id.toString(),
            recorded_for: existing.partner_id.toString(),
            recorded_by: existing.recorded_by.toString(),
            amount: existing.amount,
            currency: existing.currency,
            category: existing.category,
            context: existing.context,
            date: existing.transaction_date,
            created_at: existing.created_at,
          },
          partner_total: updatedPartner.total_contributed,
        },
      });
    }
  }

  const transaction = await Transaction.create({
    partner_id: partner._id,
    amount,
    type: "contribution",
    category: category || null,
    context: context || null,
    receipt_id: receipt_id || null,
    currency: currency || "BDT",
    transaction_date: date ? new Date(date) : new Date(),
    recorded_by:
      recorded_by && mongoose.Types.ObjectId.isValid(recorded_by)
        ? recorded_by
        : req.user._id,
    idempotency_key: idempotencyKey || null,
  });

  const updatedPartner = await Partner.findByIdAndUpdate(
    partner._id,
    { $inc: { total_contributed: amount } },
    { new: true }
  );

  res.status(201).json({
    transaction: {
      id: transaction._id.toString(),
      recorded_for: transaction.partner_id.toString(),
      recorded_by: transaction.recorded_by.toString(),
      amount: transaction.amount,
      currency: transaction.currency,
      category: transaction.category,
      context: transaction.context,
      date: transaction.transaction_date,
      created_at: transaction.created_at,
    },
    partner_total: updatedPartner.total_contributed,
  });
});

export const listTransactions = asyncHandlers(async (req, res) => {
  const {
    recorded_for,
    recorded_by,
    date_from,
    date_to,
    category,
    q,
    page = 1,
    per_page = 10,
    sort_by = "date_desc",
  } = req.query;

  const finalLimit = parseInt(per_page) || 10;
  const finalOffset = (parseInt(page) - 1) * finalLimit;

  const filter = {};

  if (recorded_for) {
    if (!mongoose.Types.ObjectId.isValid(recorded_for)) {
      throw new ApiErrors(400, "Invalid partner ID format");
    }
    filter.partner_id = recorded_for;
  }

  if (recorded_by) {
    if (!mongoose.Types.ObjectId.isValid(recorded_by)) {
      throw new ApiErrors(400, "Invalid user ID format");
    }
    filter.recorded_by = recorded_by;
  }

  if (date_from || date_to) {
    filter.transaction_date = {};
    if (date_from) filter.transaction_date.$gte = new Date(date_from);
    if (date_to) filter.transaction_date.$lte = new Date(date_to);
  }

  if (category) {
    filter.category = category;
  }

  if (q) {
    filter.$or = [
      { context: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const sort =
    sort_by === "date_asc" ? { transaction_date: 1 } : { transaction_date: -1 };

  const isCsv = req.header("Accept") === "text/csv";

  if (isCsv) {
    const transactions = await Transaction.find(filter)
      .sort(sort)
      .populate("partner_id", "name")
      .populate("recorded_by", "name email");

    const csvHeader =
      "ID,Partner,Amount,Currency,Category,Context,Date,Recorded By,Created At\n";
    const csvRows = transactions
      .map((t) =>
        [
          t._id.toString(),
          t.partner_id?.name || "",
          t.amount,
          t.currency,
          t.category || "",
          t.context || "",
          t.transaction_date?.toISOString() || "",
          t.recorded_by?.name || "",
          t.created_at.toISOString(),
        ].join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transactions.csv"
    );
    return res.send(csvHeader + csvRows);
  }

  const total = await Transaction.countDocuments(filter);

  const transactions = await Transaction.find(filter)
    .sort(sort)
    .skip(finalOffset)
    .limit(finalLimit)
    .populate("partner_id", "name avatar_url")
    .populate("recorded_by", "name email");

  const formattedTransactions = transactions.map((t) => ({
    id: t._id.toString(),
    recorded_for: t.partner_id?._id?.toString(),
    recorded_for_name: t.partner_id?.name,
    recorded_by: t.recorded_by?._id?.toString(),
    amount: Math.abs(t.amount),
    currency: t.currency,
    type: t.type,
    category: t.category,
    context: t.context,
    date: t.transaction_date,
    created_at: t.created_at,
  }));

  res.status(200).json({
    data: formattedTransactions,
    meta: {
      total,
      page: parseInt(page),
      per_page: finalLimit,
    },
  });
});

export const getTransactionDetail = asyncHandlers(async (req, res) => {
  const { transaction_id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(transaction_id)) {
    throw new ApiErrors(404, "Transaction not found");
  }

  const transaction = await Transaction.findById(transaction_id)
    .populate("partner_id", "name avatar_url email")
    .populate("recorded_by", "name email");

  if (!transaction) {
    throw new ApiErrors(404, "Transaction not found");
  }

  res.status(200).json({
    transaction: {
      id: transaction._id.toString(),
      recorded_for: transaction.partner_id?._id?.toString(),
      recorded_for_name: transaction.partner_id?.name,
      recorded_for_email: transaction.partner_id?.email,
      recorded_by: transaction.recorded_by?._id?.toString(),
      recorded_by_name: transaction.recorded_by?.name,
      recorded_by_email: transaction.recorded_by?.email,
      amount: Math.abs(transaction.amount),
      currency: transaction.currency,
      type: transaction.type,
      category: transaction.category,
      context: transaction.context,
      description: transaction.description,
      receipt_url: transaction.receipt_url,
      receipt_id: transaction.receipt_id,
      date: transaction.transaction_date,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    },
  });
});
