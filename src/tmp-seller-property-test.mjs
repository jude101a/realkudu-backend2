import 'dotenv/config';
import SellerPropertyListingModel from './models/seller.property.listing.model.js';

(async () => {
  try {
    const result = await SellerPropertyListingModel.findAllBySeller('8db54fcf-a7dc-489c-82a1-845c22271f1b', { page: 1, limit: 10 });
    console.log('RESULT', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR', err);
    if (err && err.stack) console.error(err.stack);
  }
})();
