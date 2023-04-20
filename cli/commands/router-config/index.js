const fs = require('fs');
const fse = require('fs-extra');
const yaml = require('yaml');
const { log, execCommand, filePath, execCurl } = require('../utils');
const { generateLBaddress } = require('../docker/utils');
const { execSync } = require('child_process');
const path = require('path');

async function supergraphYaml(configs, isDev) {
let port = 3300;
const coreAddress = isDev ? `http://localhost:${port}` : generateLBaddress('http://plugin-core-api');
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
    port++;
    
    const pluginAddress = isDev ? `http://localhost:${port}` : generateLBaddress(`http://plugin-${plugin.name}-api`);
    const pluginGraphqlEndpoint = `${pluginAddress}/graphql`;
    yamlObject.subgraphs[plugin.name] = {
      routing_url: pluginGraphqlEndpoint,
      schema: { subgraph_url: pluginGraphqlEndpoint }
    };
  }

  const yamlString = yaml.stringify(yamlObject);

  fs.writeFileSync(`${configs.router_config_dir}/supergraph.yaml`, yamlString);
}

async function supergraphGraphql(configs) {
    const supergraphYamlPath = `${configs.router_config_dir}/supergraph.yaml`;
    const superGraphGraphqlPath = `${configs.router_config_dir}/supergraph.graphql`;

    const command = `rover supergraph compose --config ${supergraphYamlPath} --output ${superGraphGraphqlPath} --elv2-license=accept`;

    execSync(command);
}

async function supergraph(configs, isDev) {
  await supergraphYaml(configs, isDev);
  await supergraphGraphql(configs, isDev);
}

async function config(configs) {
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
      main: "/dist/config/rhai/main.rhai"
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

  fs.writeFileSync(`${configs.router_config_dir}/router.yaml`, yaml.stringify(config));
}

async function rhai(configs) {
  const rhaiDir = path.resolve(__dirname, 'rhai');
  const targetDir = `${configs.router_config_dir}/rhai`;
  await fse.copydir(rhaiDir, targetDir);
}

async function generate(program) {
  const isDev = program && program.dev;
  const configs = await fse.readJSON(filePath('configs.json'));

  await supergraph(configs, isDev);
  await config(configs, isDev);
  await rhai(configs);
}

module.exports = {
  generate
};
