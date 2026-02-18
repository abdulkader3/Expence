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

export const updateTransaction = asyncHandlers(async (req, res) => {
  const { transaction_id } = req.params;
  const { amount, category, context, date, receipt_id, recorded_for } =
    req.body;

  if (!mongoose.Types.ObjectId.isValid(transaction_id)) {
    throw new ApiErrors(404, "Transaction not found");
  }

  const transaction = await Transaction.findById(transaction_id);
  if (!transaction) {
    throw new ApiErrors(404, "Transaction not found");
  }

  if (transaction.type !== "contribution") {
    throw new ApiErrors(400, "Only contribution transactions can be edited");
  }

  let adjustmentAmount = 0;
  let newPartnerId = transaction.partner_id;
  let oldPartnerId = transaction.partner_id;
  let partnerTotal = 0;

  const updateData = {};
  if (category !== undefined) updateData.category = category;
  if (context !== undefined) updateData.context = context;
  if (receipt_id !== undefined) updateData.receipt_id = receipt_id;
  if (date !== undefined) updateData.transaction_date = new Date(date);

  if (amount !== undefined && amount !== transaction.amount) {
    adjustmentAmount = amount - transaction.amount;
    updateData.amount = amount;
    updateData.description = transaction.description
      ? `${transaction.description} (adjusted)`
      : "Amount adjusted";
  }

  if (recorded_for && recorded_for !== transaction.partner_id.toString()) {
    if (!mongoose.Types.ObjectId.isValid(recorded_for)) {
      throw new ApiErrors(400, "Invalid partner ID format");
    }
    const newPartner = await Partner.findById(recorded_for);
    if (!newPartner) {
      throw new ApiErrors(404, "New partner not found");
    }
    newPartnerId = newPartner._id;
  }

  if (
    adjustmentAmount !== 0 ||
    newPartnerId.toString() !== oldPartnerId.toString()
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (adjustmentAmount !== 0) {
        await Transaction.findByIdAndUpdate(transaction_id, updateData, {
          session,
        });

        await Transaction.create(
          [
            {
              partner_id: newPartnerId,
              amount: adjustmentAmount,
              type: "adjustment",
              description: `Adjustment for transaction ${transaction_id}: amount changed from ${transaction.amount} to ${amount}`,
              category: category || transaction.category,
              context: context || transaction.context,
              currency: transaction.currency,
              transaction_date: new Date(),
              recorded_by: req.user._id,
              idempotency_key: null,
            },
          ],
          { session }
        );

        await Partner.findByIdAndUpdate(
          newPartnerId,
          { $inc: { total_contributed: adjustmentAmount } },
          { session }
        );
      } else {
        await Partner.findByIdAndUpdate(
          oldPartnerId,
          { $inc: { total_contributed: -transaction.amount } },
          { session }
        );
        await Partner.findByIdAndUpdate(
          newPartnerId,
          { $inc: { total_contributed: transaction.amount } },
          { session }
        );
        await Transaction.findByIdAndUpdate(
          transaction_id,
          { ...updateData, partner_id: newPartnerId },
          { session }
        );
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    await Transaction.findByIdAndUpdate(transaction_id, updateData);
  }

  const updatedPartner = await Partner.findById(newPartnerId);

  const updatedTransaction = await Transaction.findById(transaction_id)
    .populate("partner_id", "name avatar_url email")
    .populate("recorded_by", "name email");

  res.status(200).json({
    transaction: {
      id: updatedTransaction._id.toString(),
      recorded_for: updatedTransaction.partner_id?._id?.toString(),
      recorded_for_name: updatedTransaction.partner_id?.name,
      recorded_by: updatedTransaction.recorded_by?._id?.toString(),
      amount: Math.abs(updatedTransaction.amount),
      currency: updatedTransaction.currency,
      type: updatedTransaction.type,
      category: updatedTransaction.category,
      context: updatedTransaction.context,
      date: updatedTransaction.transaction_date,
      created_at: updatedTransaction.created_at,
    },
    partner_total: updatedPartner.total_contributed,
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

export const undoTransaction = asyncHandlers(async (req, res) => {
  const { transaction_id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(transaction_id)) {
    throw new ApiErrors(404, "Transaction not found");
  }

  const originalTransaction = await Transaction.findById(transaction_id);
  if (!originalTransaction) {
    throw new ApiErrors(404, "Transaction not found");
  }

  if (originalTransaction.type === "undo") {
    throw new ApiErrors(400, "This transaction has already been undone");
  }

  const existingUndo = await Transaction.findOne({
    related_to: transaction_id,
  });
  if (existingUndo) {
    throw new ApiErrors(400, "This transaction has already been undone");
  }

  const partner = await Partner.findById(originalTransaction.partner_id);
  if (!partner) {
    throw new ApiErrors(404, "Partner not found");
  }

  const isReversing =
    new Date() - new Date(originalTransaction.created_at) > 5 * 1000;

  const undoTransaction = await Transaction.create({
    partner_id: originalTransaction.partner_id,
    amount: -Math.abs(originalTransaction.amount),
    type: "undo",
    description: reason
      ? `Undo reason: ${reason}`
      : `Undo of transaction ${transaction_id}`,
    category: originalTransaction.category,
    context: originalTransaction.context,
    currency: originalTransaction.currency,
    transaction_date: new Date(),
    recorded_by: req.user._id,
    related_to: originalTransaction._id,
    is_reversing: !isReversing,
  });

  await Partner.findByIdAndUpdate(originalTransaction.partner_id, {
    $inc: { total_contributed: -Math.abs(originalTransaction.amount) },
  });

  const updatedPartner = await Partner.findById(originalTransaction.partner_id);

  res.status(201).json({
    undo_transaction: {
      id: undoTransaction._id.toString(),
      type: undoTransaction.type,
      amount: Math.abs(undoTransaction.amount),
      related_to: originalTransaction._id.toString(),
    },
    partner_total: updatedPartner.total_contributed,
  });
});

export const getLeaderboard = asyncHandlers(async (req, res) => {
  const { limit = 10, include_recent_transactions } = req.query;

  const finalLimit = parseInt(limit) || 10;

  const pipeline = [
    {
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
          { $limit: 1 },
        ],
        as: "last_contribution_lookup",
      },
    },
    {
      $addFields: {
        last_contribution_at: {
          $cond: {
            if: { $gt: [{ $size: "$last_contribution_lookup" }, 0] },
            then: { $arrayElemAt: ["$last_contribution_lookup.created_at", 0] },
            else: null,
          },
        },
      },
    },
    {
      $sort: {
        total_contributed: -1,
        last_contribution_at: -1,
      },
    },
    { $limit: finalLimit },
    {
      $project: {
        last_contribution_lookup: 0,
      },
    },
  ];

  if (include_recent_transactions === "true") {
    pipeline[0].$lookup.pipeline.push({ $limit: 5 });
    pipeline[4].$project.recent_transactions = {
      $map: {
        input: "$last_contribution_lookup",
        as: "t",
        in: {
          id: "$$t._id",
          amount: "$$t.amount",
          type: "$$t.type",
          description: "$$t.description",
          created_at: "$$t.created_at",
        },
      },
    };
  }

  const leaderboard = await Partner.aggregate(pipeline);

  let rank = 0;
  let previousTotal = null;

  const formattedLeaderboard = leaderboard.map((partner, index) => {
    if (partner.total_contributed !== previousTotal) {
      rank = index + 1;
      previousTotal = partner.total_contributed;
    }

    return {
      partner_id: partner._id.toString(),
      name: partner.name,
      avatar_url: partner.avatar_url,
      total_contributed: partner.total_contributed,
      rank,
      top_contributor: rank === 1,
      last_contribution_at: partner.last_contribution_at,
      ...(include_recent_transactions === "true" && {
        recent_transactions: partner.recent_transactions?.map((t) => ({
          id: t.id?.toString(),
          amount: t.amount,
          type: t.type,
          description: t.description,
          created_at: t.created_at,
        })),
      }),
    };
  });

  res.status(200).json({
    data: formattedLeaderboard,
    meta: {
      as_of: new Date().toISOString(),
    },
  });
});

export const exportTransactionsCSV = asyncHandlers(async (req, res) => {
  const { recorded_for, date_from, date_to, category } = req.query;

  const filter = {};

  if (recorded_for) {
    if (!mongoose.Types.ObjectId.isValid(recorded_for)) {
      throw new ApiErrors(400, "Invalid partner ID format");
    }
    filter.partner_id = recorded_for;
  }

  if (date_from || date_to) {
    filter.transaction_date = {};
    if (date_from) filter.transaction_date.$gte = new Date(date_from);
    if (date_to) filter.transaction_date.$lte = new Date(date_to);
  }

  if (category) {
    filter.category = category;
  }

  const date = new Date();
  const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `transactions_${formattedDate}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const csvHeader =
    "id,recorded_for,recorded_by,amount,currency,category,context,date,receipt_url\n";
  res.write(csvHeader);

  const cursor = Transaction.find(filter)
    .sort({ transaction_date: -1 })
    .populate("partner_id", "name")
    .populate("recorded_by", "name email")
    .cursor();

  for await (const t of cursor) {
    const row = [
      t._id.toString(),
      t.partner_id?.name || "",
      t.recorded_by?.name || "",
      t.amount,
      t.currency,
      t.category || "",
      t.context || "",
      t.transaction_date?.toISOString() || "",
      t.receipt_url || "",
    ].join(",");
    res.write(row + "\n");
  }

  res.end();
});

export const syncOfflineQueue = asyncHandlers(async (req, res) => {
  const { device_id, queue } = req.body;

  if (!device_id) {
    throw new ApiErrors(400, "device_id is required");
  }

  if (!queue || !Array.isArray(queue) || queue.length === 0) {
    throw new ApiErrors(400, "queue must be a non-empty array");
  }

  const results = [];

  for (const item of queue) {
    const { local_id, action, payload, timestamp, idempotency_key } = item;

    if (!local_id || !action || !payload) {
      results.push({
        local_id: local_id || "unknown",
        status: "error",
        error: "Missing required fields: local_id, action, payload",
      });
      continue;
    }

    const dedupKey = idempotency_key || local_id;

    try {
      if (action === "addContribution") {
        const existing = await Transaction.findOne({
          idempotency_key: dedupKey,
        });

        if (existing) {
          results.push({
            local_id,
            status: "ok",
            server_id: existing._id.toString(),
            duplicate: true,
          });
          continue;
        }

        if (!payload.recorded_for || !payload.amount) {
          results.push({
            local_id,
            status: "error",
            error: "Missing required payload fields: recorded_for, amount",
          });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(payload.recorded_for)) {
          results.push({
            local_id,
            status: "error",
            error: "Invalid partner ID format",
          });
          continue;
        }

        const partner = await Partner.findById(payload.recorded_for);
        if (!partner) {
          results.push({
            local_id,
            status: "error",
            error: "Partner not found",
          });
          continue;
        }

        const transaction = await Transaction.create({
          partner_id: partner._id,
          amount: payload.amount,
          type: "contribution",
          category: payload.category || null,
          context: payload.context || null,
          receipt_id: payload.receipt_id || null,
          currency: payload.currency || "BDT",
          transaction_date: timestamp ? new Date(timestamp) : new Date(),
          recorded_by: req.user._id,
          idempotency_key: dedupKey,
        });

        await Partner.findByIdAndUpdate(partner._id, {
          $inc: { total_contributed: payload.amount },
        });

        results.push({
          local_id,
          status: "ok",
          server_id: transaction._id.toString(),
        });
      } else if (action === "undoTransaction") {
        const existing = await Transaction.findOne({
          idempotency_key: dedupKey,
        });

        if (existing) {
          results.push({
            local_id,
            status: "ok",
            server_id: existing._id.toString(),
            duplicate: true,
          });
          continue;
        }

        if (!payload.transaction_id) {
          results.push({
            local_id,
            status: "error",
            error: "Missing required payload field: transaction_id",
          });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(payload.transaction_id)) {
          results.push({
            local_id,
            status: "error",
            error: "Invalid transaction ID format",
          });
          continue;
        }

        const originalTransaction = await Transaction.findById(
          payload.transaction_id
        );
        if (!originalTransaction) {
          results.push({
            local_id,
            status: "error",
            error: "Original transaction not found",
          });
          continue;
        }

        const existingUndo = await Transaction.findOne({
          related_to: payload.transaction_id,
        });
        if (existingUndo) {
          results.push({
            local_id,
            status: "ok",
            server_id: existingUndo._id.toString(),
            duplicate: true,
          });
          continue;
        }

        const undoTransaction = await Transaction.create({
          partner_id: originalTransaction.partner_id,
          amount: -Math.abs(originalTransaction.amount),
          type: "undo",
          description: payload.reason
            ? `Undo reason: ${payload.reason}`
            : `Undo of transaction ${payload.transaction_id}`,
          category: originalTransaction.category,
          context: originalTransaction.context,
          currency: originalTransaction.currency,
          transaction_date: timestamp ? new Date(timestamp) : new Date(),
          recorded_by: req.user._id,
          related_to: originalTransaction._id,
          idempotency_key: dedupKey,
        });

        await Partner.findByIdAndUpdate(originalTransaction.partner_id, {
          $inc: { total_contributed: -Math.abs(originalTransaction.amount) },
        });

        results.push({
          local_id,
          status: "ok",
          server_id: undoTransaction._id.toString(),
        });
      } else {
        results.push({
          local_id,
          status: "error",
          error: `Unknown action: ${action}`,
        });
      }
    } catch (error) {
      results.push({
        local_id,
        status: "error",
        error: error.message || "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.status === "ok").length;

  res.status(200).json({
    results,
    summary: {
      total: queue.length,
      success: successCount,
      failed: queue.length - successCount,
    },
  });
});
