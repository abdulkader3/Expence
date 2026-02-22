import Sale from "../models/sale.model.js";
import Allocation from "../models/allocation.model.js";
import mongoose from "mongoose";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";

export const getSalesSummary = asyncHandlers(async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    throw new ApiErrors(
      400,
      "Both 'from' and 'to' date parameters are required"
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const userId = new mongoose.Types.ObjectId(req.user._id);

  const salesPipeline = [
    {
      $match: {
        status: "completed",
        date: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: "$sale_total" },
        total_sales: { $sum: 1 },
        revenue_by_payment_method: {
          $push: {
            payment_method: "$payment_method",
            sale_total: "$sale_total",
          },
        },
        sale_ids: { $push: "$_id" },
      },
    },
  ];

  const salesResult = await Sale.aggregate(salesPipeline);

  if (!salesResult.length || salesResult[0].total_sales === 0) {
    return res.status(200).json({
      summary: {
        period: { from: fromDate, to: toDate },
        total_revenue: 0,
        total_allocated_cost: 0,
        total_profit: 0,
        overall_profit_margin: 0,
        total_sales: 0,
        revenue_by_payment_method: [],
      },
    });
  }

  const { total_revenue, total_sales, revenue_by_payment_method, sale_ids } =
    salesResult[0];

  const revenueAgg = {};
  revenue_by_payment_method.forEach((item) => {
    if (!revenueAgg[item.payment_method]) {
      revenueAgg[item.payment_method] = 0;
    }
    revenueAgg[item.payment_method] += item.sale_total;
  });

  const revenueByPaymentMethod = Object.entries(revenueAgg).map(
    ([method, amount]) => ({
      payment_method: method,
      revenue: amount,
    })
  );

  const allocationsPipeline = [
    {
      $match: {
        sale_id: { $in: sale_ids },
      },
    },
    {
      $group: {
        _id: null,
        total_allocated_cost: { $sum: "$allocated_amount" },
      },
    },
  ];

  const allocationsResult = await Allocation.aggregate(allocationsPipeline);
  const total_allocated_cost =
    allocationsResult.length > 0
      ? allocationsResult[0].total_allocated_cost
      : 0;

  const total_profit = total_revenue - total_allocated_cost;
  const overall_profit_margin =
    total_revenue > 0 ? (total_profit / total_revenue) * 100 : 0;

  res.status(200).json({
    summary: {
      period: { from: fromDate, to: toDate },
      total_revenue,
      total_allocated_cost,
      total_profit,
      overall_profit_margin: parseFloat(overall_profit_margin.toFixed(2)),
      total_sales,
      revenue_by_payment_method: revenueByPaymentMethod,
    },
  });
});
