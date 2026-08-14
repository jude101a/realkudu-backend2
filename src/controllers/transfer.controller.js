import TransferService from "../services/transfer.service.js";

class TransferController {
  async initiate(req, res, next) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const transfer = await TransferService.initiateTransfer({
        escrow: req.body.escrow,
        recipientCode: req.body.recipientCode,
        reason: req.body.reason,
      });

      return res.status(201).json({
        success: true,
        message: "Transfer initiated.",
        data: transfer,
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
