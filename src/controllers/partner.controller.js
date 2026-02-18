import Partner from "../models/partner.model.js";
import Transaction from "../models/transaction.model.js";
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
          { $limit: include_transactions === "true" ? 5 : 0 },
        ],
        as: "recent_transactions",
      },
    },
    {
      $addFields: {
        last_contribution_at: {
          $cond: {
            if: { $gt: [{ $size: "$recent_transactions" }, 0] },
            then: { $arrayElemAt: ["$recent_transactions.created_at", 0] },
            else: null,
          },
        },
      },
    },
    {
      $sort: {
        [sortField]: sortOrder,
        last_contribution_at: -1,
      },
    },
    { $skip: finalOffset },
    { $limit: finalLimit },
  ];

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
