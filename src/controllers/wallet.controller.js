import WalletService from "../services/wallet.service.js";

class WalletController {
  async getWallet(req, res, next) {
    try {
      const sellerId = req.user?.id;

      if (!sellerId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const wallet = await WalletService.getSellerWallet(sellerId, {
        page: req.query.page,
        limit: req.query.limit,
      });

      return res.json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new WalletController();
