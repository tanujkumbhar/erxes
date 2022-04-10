import { generateFieldsFromSchema } from '@erxes/api-utils/src';
import { generateModels } from './connectionResolver';
import { CONVERSATION_INFO } from './constants';

const generateFields = async ({ subdomain }) => {
  const models = await generateModels(subdomain);

  const schema: any = models.Conversations.schema;

  let fields: Array<{
    _id: number;
    name: string;
    group?: string;
    label?: string;
    type?: string;
    validation?: string;
    options?: string[];
    selectOptions?: Array<{ label: string; value: string }>;
  }> = [];

  // generate list using customer or company schema
  fields = [...fields, ...(await generateFieldsFromSchema(schema, ''))];

  for (const name of Object.keys(schema.paths)) {
    const path = schema.paths[name];

    // extend fields list using sub schema fields
    if (path.schema) {
      fields = [
        ...fields,
        ...(await generateFieldsFromSchema(path.schema, `${name}.`))
      ];
    }
  }

  return fields;
};

export default {
  types: [
    {
      description: 'Conversation details',
      type: 'conversation'
    }
  ],
  fields: generateFields,
  systemFields: ({ data: { groupId } }) =>
    CONVERSATION_INFO.ALL.map(e => ({
      text: e.label,
      type: e.field,
      groupId,
      contentType: `inbox:conversation`,
      isDefinedByErxes: true
    }))
};
