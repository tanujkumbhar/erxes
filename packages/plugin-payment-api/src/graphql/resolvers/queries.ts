import { requireLogin } from '@erxes/api-utils/src/permissions';
import { IContext } from '../../connectionResolver';

const paymentConfigQueries = {
  paymentConfigs(_root, _args, { models }: IContext) {
    return models.PaymentConfigs.find({ status: 'active' });
  },

  paymentConfigsCountByType(_root, params, { models }: IContext) {
    return models.PaymentConfigs.find({
      type: params.type,
      status: 'active'
    }).countDocuments();
  }
};

requireLogin(paymentConfigQueries, 'paymentConfigs');
requireLogin(paymentConfigQueries, 'paymentConfigsCountByType');

export default paymentConfigQueries;
