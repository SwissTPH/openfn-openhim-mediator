FROM node:dubnium-alpine

WORKDIR /app

COPY package.json package-lock.json ./

##RUN apk update and apk add git && npm install
#https://github.com/nodejs/docker-node/issues/586

RUN apk update && apk add bash && apk add --no-cache git

RUN npm install

COPY . .
CMD npm start
EXPOSE 4321
