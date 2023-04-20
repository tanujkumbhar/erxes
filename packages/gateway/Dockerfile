FROM node:14.21.3-bullseye-slim

RUN apt-get update -y
RUN apt-get install -y curl

WORKDIR /erxes-gateway
RUN chown -R node:node /erxes-gateway
COPY --chown=node:node . /erxes-gateway

RUN curl -sSL https://rover.apollo.dev/nix/v0.14.0 | sh
ENV PATH="$PATH:/root/.rover/bin"
# force rover to download its supergraph plugin
RUN cd /erxes-gateway/src/apollo-router/dummy && rover supergraph compose --config ./supergraph.yaml --elv2-license=accept
RUN chown -R node:node /root/.rover/bin

USER node

ENTRYPOINT ["node", "--max-http-header-size=16384", "dist/gateway/src"]
