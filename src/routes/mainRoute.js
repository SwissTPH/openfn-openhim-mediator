'use strict'

import {buildReturnObject} from './utils'
const { Execute, Execute_noCLI } = require('../../core/lib/execute_noCLI');
var http = require('http');

const {VM} = require('vm2')

import openhim from '../openhim'
import logger from '../logger'

import {log} from 'async'

module.exports = async (_req, res) => {
  if (openhim.config.first_mediator)
  {
    var state = {}
    state.data = _req.body
  }else {
    console.log(typeof _req.body)
    state = _req.body
  }
  try {
    let vm = new VM({sandbox: {state}})
    var trigger = vm.run(openhim.config.trigger)
  } catch (error) {
    logger.error(error)
  }
  if (trigger) {
    logger.info('---Event Triggered---')
    state.configuration = {
      username: openhim.config.server.user,
      password: openhim.config.server.password,
      hostUrl: openhim.config.server.url
    }
    var expression = openhim.config.job.expression
    var lan_path = `./languages/${openhim.config.job.language}.Adaptor`
    var obj = await Execute_noCLI(expression, state, [],lan_path)
        .then(state => {
          if (openhim.config.nxt_mediator){
            logger.info("routing towards second mediator...")
            var content_length = JSON.stringify(state).length
            // An object of options to indicate where to post to
            var post_options = {
              host: 'mediator',
              port: '4321',
              path: openhim.config.nxt_mediator,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': content_length
              }
            };
            // Set up the request
            logger.info("New state: " + JSON.stringify(state))
            var post_req = http.request(post_options, function(res) {
              res.setEncoding('utf8');
              res.on('data', function (chunk) {
                logger.info('Response from ' + openhim.config.nxt_mediator+': ' + chunk);
                return chunk
              });
            });
            // post the data
            post_req.write(JSON.stringify(state));
            post_req.end();

          }
          return state;
        })
        .then(state => {
          console.log("---------");
          console.log('Finished.');
          if (state.references !== undefined && state.references.length !== 0) {
            if (state.references[0].body) {
              const returnObject = buildReturnObject(
                  state.references[0].body.httpStatus,
                  state.references[0].body.httpStatusCode,
                  state.references[0].body.message,
                  state
              );
              return res.status(state.references[0].body.httpStatusCode).send(returnObject)
            }else if (state.references[0].status === 'COMPLETED'){
              // let failed_list = []
              // var counter = 1;
              // for (let element in state.references){
              //   if (element.status !== 'COMPLETED'){
              //     failed_list.push(counter)
              //     counter +=1;
              //   }
              // }
              const returnObject = buildReturnObject(
                  state.references[0].httpStatus? state.references[0].httpStatus : 'Completed',
                  state.references[0].httpStatusCode? state.references[0].httpStatusCode : 202,
                  state.references[0].message? state.references[0].message : 'A duplicate was found! No action taken',
                  state
              );
              return res.status(state.references[0].httpStatusCode? state.references[0].httpStatusCode: 202).send(returnObject)
            }
          }else if (state.body){
            const returnObject = buildReturnObject(
                state.body.httpStatus,
                state.body.httpStatusCode,
                state.body.message,
                state
            );
            return res.status(state.body.httpStatusCode).send(returnObject)
          }
        })
        .catch(err => {
          logger.error(err)
          if (err.response) {
            if (err.response.text){
              err = JSON.parse(err.response.text)
              const returnObject = buildReturnObject(
                  err.httpStatus,
                  err.httpStatusCode,
                  err.message,
                  err
              );
              return res.status(err.httpStatusCode).send(returnObject)
            }else {
            const returnObject = buildReturnObject(
                err.response.body.httpStatus,
                err.response.body.httpStatusCode,
                err.response.body.message + ' \\n ' + JSON.stringify(err.response.body.response.importSummaries),
                err
            );
              return res.status(err.response.body.httpStatusCode).send(returnObject)
            }
          }else if (err.message){
            if (typeof err.message === "string" && err.message.startsWith('responded')){
              err = JSON.parse(err.message.split('responded with:', 2)[1]);
              logger.error("Promise rejected with error: " + JSON.stringify(err))
              console.log(Object.keys(err));
              const returnObject = buildReturnObject(
                  err.body.httpStatus,
                  err.body.httpStatusCode,
                  err.body.message,
                  err
              );
              return res.status(err.body.httpStatusCode).send(returnObject)
            }else{
            try {
              if (err.message['responded with:']) {
                var err = JSON.parse(err.message.split('responded with:', 2)[1]);
                logger.error(err)
                const returnObject = buildReturnObject(
                    err.body.httpStatus,
                    err.body.httpStatusCode,
                    err.body.message + " " + JSON.stringify(error_obj.body.response.conflicts),
                    err
                );
                return res.status(err.body.httpStatusCode).send(returnObject)
              }else {
                err = JSON.parse(err.response.text)
                const returnObject = buildReturnObject(
                    err.httpStatus,
                    err.httpStatusCode,
                    err.message,
                    err
                );
                return res.status(err.httpStatusCode).send(returnObject)
              }
            }catch {
              const returnObject = buildReturnObject(
                  "Failed",
                  500,
                  err.message,
                  err
              );
              return res.status(500).send(returnObject)
            }
            }
          }
        });
  } else {
    const returnObject = buildReturnObject('Failed', 409, {
      message: 'Trigger did not activate, no action was performed.',
      url: _req.url,
      method: _req.method
    })
    res.status(409).send(returnObject)
  }
}
