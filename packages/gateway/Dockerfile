FROM node:16.20.0-bullseye-slim

RUN apt-get update -y
RUN apt-get install -y curl

RUN yarn global add @apollo/rover@0.14.0

WORKDIR /erxes-gateway
RUN chown -R node:node /erxes-gateway
COPY --chown=node:node . /erxes-gateway

# force rover to download its supergraph plugin
RUN cd /erxes-gateway/src/apollo-router/dummy && rover supergraph compose --config ./supergraph.yaml --elv2-license=accept

USER node

RUN mkdir -p /erxes-gateway/dist/gateway/src/apollo-router/temp

ENTRYPOINT ["node", "--max-http-header-size=16384", "dist/gateway/src"]
