import { ICommonFormProps } from '@erxes/ui-settings/src/common/types'
import { IRouterProps } from '@erxes/ui/src/types'
import { withProps } from '@erxes/ui/src/utils/core'
import gql from 'graphql-tag'
import * as compose from 'lodash.flowright'
import React from 'react'
import { graphql } from 'react-apollo'
import { withRouter } from 'react-router-dom'
import {
  RiskAssesmentsCategoriesQueryResponse,
  RiskAssessmentDetailQueryResponse
} from '../common/types'
import FormCompnent from '../components/Form'
import { queries } from '../graphql'

type Props = {
  asssessmentId?: string;
  assessmentDetail?: RiskAssessmentDetailQueryResponse;
};

type FinalProps = {
  object;
  generateDoc: (values: any) => any;
  categories: RiskAssesmentsCategoriesQueryResponse;
} & ICommonFormProps &
  IRouterProps &
  Props;

class FormContainer extends React.Component<FinalProps> {
  constructor(props) {
    super(props);
  }

  render() {
    const { categories, assessmentDetail } = this.props;

    const updatedProps = {
      ...this.props,
      categories: categories.getRiskAssesmentCategories,
      loading: categories.loading,
      assessmentDetail: assessmentDetail?.riskAssessmentDetail,
      detailLoading: assessmentDetail?.loading,
    };

    return <FormCompnent {...updatedProps} />;
  }
}

export default withProps<Props>(
  compose(
    graphql<Props>(gql(queries.listAssessmentCategories), {
      name: 'categories',
    }),
    graphql<Props>(gql(queries.assessmentDetail), {
      name: 'assessmentDetail',
      skip: ({ asssessmentId }) => !asssessmentId,
      options: ({ asssessmentId }) => ({
        variables: { id: asssessmentId },
      }),
    })
  )(withRouter<IRouterProps>(FormContainer))
);