import * as dotenv from 'dotenv';
dotenv.config();

import { ErxesProxyTarget } from 'src/proxy/targets';
import { supergraphConfigPath, supergraphPath } from './paths';
import * as fs from 'fs';
import { exec as execCb } from 'child_process';
import isSameFile from '../util/is-same-file';
import * as yaml from 'yaml';
import { promisify } from 'util';

const exec = promisify(execCb);

const { NODE_ENV, SUPERGRAPH_POLL_INTERVAL_MS } = process.env;

type SupergraphConfig = {
  federation_version: string;
  subgraphs: {
    [name: string]: {
      routing_url: string;
      schema: {
        subgraph_url: string;
      };
    };
  };
};

const createSupergraphConfig = async (proxyTargets: ErxesProxyTarget[]) => {
  const superGraphConfigNext = supergraphConfigPath + '.next';
  const config: SupergraphConfig = {
    federation_version: '=2.3.1',
    subgraphs: {}
  };

  for (const { name, address } of proxyTargets) {
    const endpoint = `${address}/graphql`;
    config.subgraphs[name] = {
      routing_url: endpoint,
      schema: {
        subgraph_url: endpoint
      }
    };
  }
  fs.writeFileSync(superGraphConfigNext, yaml.stringify(config), {
    encoding: 'utf-8'
  });

  if (
    !fs.existsSync(supergraphConfigPath) ||
    !isSameFile(supergraphConfigPath, superGraphConfigNext)
  ) {
    const { stdout, stderr } = await exec(
      `cp ${superGraphConfigNext}  ${supergraphConfigPath}`
    );
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  }
};

const supergraphComposeOnce = async () => {
  if (NODE_ENV === 'production') {
    // Don't rewrite supergraph schema if it exists. Delete and restart to update the supergraph.graphql
    // if (fs.existsSync(supergraphPath)) {
    //   return;
    // }
    const cp = exec(
      `rover supergraph compose --config ${supergraphConfigPath} --output ${supergraphPath} --elv2-license=accept`
    );

    ['close', 'disconnect', 'error', 'exit', 'message', 'spawn'].forEach(
      eventName => {
        cp.child.on(eventName, code => {
          console.log(`rover supergraph compose ${eventName} ${code}`);
        });
      }
    );

    const { stdout, stderr } = await cp;

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } else {
    const superGraphqlNext = supergraphPath + '.next';
    const { stdout, stderr } = await exec(
      `yarn rover supergraph compose --config ${supergraphConfigPath} --output ${
        NODE_ENV === 'development' ? superGraphqlNext : supergraphPath
      } --elv2-license=accept`
    );
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    if (
      !fs.existsSync(supergraphPath) ||
      !isSameFile(supergraphPath, superGraphqlNext)
    ) {
      const { stdout, stderr } = await exec(
        `cp ${superGraphqlNext} ${supergraphPath}`
      );
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      console.log(`NEW Supergraph Schema was printed to ${supergraphPath}`);
    }
  }
};

export default async function supergraphCompose(
  proxyTargets: ErxesProxyTarget[]
) {
  await createSupergraphConfig(proxyTargets);
  await supergraphComposeOnce();
  if (NODE_ENV === 'development') {
    setInterval(async () => {
      try {
        await supergraphComposeOnce();
      } catch (e) {
        console.error(e.message);
      }
    }, Number(SUPERGRAPH_POLL_INTERVAL_MS) || 10_000);
  }
}
