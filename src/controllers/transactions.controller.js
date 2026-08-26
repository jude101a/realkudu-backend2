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
      const transfer = await TransferService.getTransferStatus(req.params.reference);

      return res.json({
        success: true,
        data: transfer,
      });
    } catch (error) {
      next(error);
    }
  }

  async listSellerTransfers(req, res, next) {
    try {
      const transfers = await TransferService.listSellerTransfers(req.params.sellerId, {
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json({
        success: true,
        data: transfers,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TransferController();
