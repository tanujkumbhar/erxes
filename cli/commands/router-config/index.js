const fs = require('fs');
const fse = require('fs-extra');
const yaml = require('yaml');
const { filePath } = require('../utils');
const { generateLBaddress } = require('../docker/utils');
const { execSync } = require('child_process');
const path = require('path');

async function supergraphYaml(configs) {
  const coreAddress = generateLBaddress('http://plugin-core-api');
  const coreGraphqlEndpoint = `${coreAddress}/graphql`;
  const yamlObject = {
    federation_version: '=2.3.1',
    subgraphs: {
      core: {
        routing_url: coreGraphqlEndpoint,
        schema: { subgraph_url: coreGraphqlEndpoint }
      }
    }
  };

  for (const plugin of configs.plugins || []) {
    const pluginAddress = generateLBaddress(`http://plugin-${plugin.name}-api`);
    const pluginGraphqlEndpoint = `${pluginAddress}/graphql`;
    yamlObject.subgraphs[plugin.name] = {
      routing_url: pluginGraphqlEndpoint,
      schema: { subgraph_url: pluginGraphqlEndpoint }
    };
  }

  const yamlString = yaml.stringify(yamlObject);

  fs.writeFileSync(
    filePath(`./apollo-router-config/supergraph.yaml`),
    yamlString
  );
}

async function supergraphGraphql() {
  const supergraphYamlPath = filePath(`./apollo-router-config/supergraph.yaml`);
  const superGraphGraphqlPath = filePath(
    `./apollo-router-config/supergraph.graphql`
  );

  const command = `rover supergraph compose --config ${supergraphYamlPath} --output ${superGraphGraphqlPath} --elv2-license=accept`;

  execSync(command);
}

async function routerYaml(configs) {
  const widgets = configs.widgets || {};
  const WIDGETS_DOMAIN = widgets.domain || `${configs.domain}/widgets`;
  const CLIENT_PORTAL_DOMAINS = configs.client_portal_domains || '';
  const ALLOWED_ORIGINS = configs.allowed_origins;
  const { DOMAIN } = configs || {};

  const config = {
    include_subgraph_errors: {
      all: true
    },
    rhai: {
      main: '/dist/config/rhai/main.rhai'
    },
    cors: {
      allow_credentials: true,
      origins: [
        DOMAIN ? DOMAIN : 'http://localhost:3000',
        WIDGETS_DOMAIN ? WIDGETS_DOMAIN : 'http://localhost:3200',
        ...(CLIENT_PORTAL_DOMAINS || '').split(','),
        'https://studio.apollographql.com'
      ].filter(x => typeof x === 'string'),
      match_origins: (ALLOWED_ORIGINS || '').split(',').filter(Boolean)
    },
    headers: {
      all: {
        request: [
          {
            propagate: {
              matching: '.*'
            }
          }
        ]
      }
    },
    supergraph: {
      listen: '0.0.0.0:4000'
    }
  };

  fs.writeFileSync(
    filePath(`./apollo-router-config/router.yaml`),
    yaml.stringify(config)
  );
}

async function rhai() {
  const rhaiDir = path.resolve(__dirname, 'rhai');
  const targetDir = filePath(`./apollo-router-config/rhai`);
  await fse.copydir(rhaiDir, targetDir);
}

async function generate() {
  const configs = await fse.readJSON(filePath('configs.json'));
  await supergraphYaml(configs, isDev);
  await supergraphGraphql();
  await routerYaml(configs);
  await rhai();
}

module.exports = {
  generate
};
