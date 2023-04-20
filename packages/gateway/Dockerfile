FROM node:14.21.3-bullseye-slim

RUN apt-get update -y
RUN apt-get install -y curl

WORKDIR /erxes-gateway
RUN /erxes-gateway
COPY . /erxes-gateway

RUN curl -sSL https://rover.apollo.dev/nix/v0.14.0 | sh
ENV PATH="$PATH:/root/.rover/bin"
# force rover to download its supergraph plugin
RUN cd /erxes-gateway/src/apollo-router/dummy && rover supergraph compose --config ./supergraph.yaml --elv2-license=accept


ENTRYPOINT ["node", "--max-http-header-size=16384", "dist/gateway/src"]
