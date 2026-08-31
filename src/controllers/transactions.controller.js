import TransactionModel from "../models/transactions.model.js";

class TransactionController {
  async initiate(req, res, next) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const transaction = await TransactionModel.createTransaction({
  transactionType: req.body.transactionType,
  coverImageUrl: req.body.coverImageUrl,
  title: req.body.title,
  propertyId: req.body.propertyId,
  userId: req.user.id,
  amount: req.body.amount,
});

      return res.status(201).json({
        success: true,
        message: "Transaction initiated.",
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req, res, next) {
    try {
      const transfer = await TransactionService.getTransactionStatus(req.params.reference);

      return res.json({
        success: true,
        data: transfer,
      });
    } catch (error) {
      next(error);
    }
  }
  async getTransaction(req, res, next) {
    try {
      const transaction = await TransactionModel.getTransaction(req.params.id, req.user.id);

      return res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  async listSellerTransactions(req, res, next) {
    try {
      const transactions = await TransactionModel.getTransactions(req.params.sellerId, {
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TransactionController();
