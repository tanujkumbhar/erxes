const fs = require('fs');
const fse = require('fs-extra');
const yaml = require('yaml');
const { log, execCommand, filePath, execCurl } = require('../utils');
const { generateLBaddress } = require('../docker/utils');
const { execSync } = require('child_process');

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

async function config(configs) {}

async function rhai() {}

async function generate(program) {
  const isDev = program && program.dev;
  const configs = await fse.readJSON(filePath('configs.json'));

  await supergraph(configs, isDev);
  await config(configs, isDev);
  await rhai();
}

module.exports = {
  generate
};
