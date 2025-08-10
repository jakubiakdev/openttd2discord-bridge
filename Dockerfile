FROM node:lts-alpine3.22

ADD --chown=node . /bridge
WORKDIR /bridge
USER node

RUN npm install

CMD ["node", "index.js"]
