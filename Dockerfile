FROM amazon/aws-lambda-nodejs:14
WORKDIR /work

RUN npm install -g yarn \
  && yum install -y zip \
  && yum clean all \
  && rm -rf /var/cache/yum/*

COPY package.json yarn.lock ./
COPY packages/websocket/package.json ./packages/websocket/
COPY packages/deployment/package.json ./packages/deployment/
RUN yarn install

RUN mkdir -p pacakge \
  && yarn install --production --modules-folder ./package/node_modules

COPY ./ ./
RUN yarn workspace websocket build \
  && cp -r packages/websocket/dist/* package \
  && cd package \
  && zip -r -9 ../package.zip .
