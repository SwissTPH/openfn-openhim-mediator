'use strict'

import {buildReturnObject} from './utils'
const Execute_noCLI = require('../../core/lib/execute_noCLI')

const {VM} = require('vm2')

import openhim from '../openhim'

import {log} from 'async'

module.exports = async (_req, res) => {
  var state = _req.body
  try {
    let vm = new VM({sandbox: {state}})
    var trigger = vm.run(openhim.config.trigger)
  } catch (error) {
    console.log(error)
  }
  if (trigger) {
    console.log('---Event Triggered---')
    state.configuration = {
      username: openhim.config.server.user,
      password: openhim.config.server.password,
      hostUrl: openhim.config.server.url
    }
    var expression = openhim.config.job.expression
    var lan_path = `./languages/${openhim.config.job.language}.Adaptor`
    var obj = await Execute_noCLI(expression, state, [],lan_path)
        .then(state => {
          console.log("state: "+ state)
          return state;
        })
        .then(state => {
          console.log("---------");
          console.log('Finished.');
          if (state.references !== undefined && state.references.length !== 0) {
            const returnObject = buildReturnObject(
                state.references[0].body.httpStatus,
                state.references[0].body.httpStatusCode,
                state.references[0].body.message
            );
            return res.status(state.references[0].body.httpStatusCode).send(returnObject)
          }else if (state.body){
            const returnObject = buildReturnObject(
                state.body.httpStatus,
                state.body.httpStatusCode,
                state.body.message
            );
            return res.status(state.body.httpStatusCode).send(returnObject)
          }
          else {
            return state
          }
        })
        .catch(err => {
          console.log("Error: " + err)
          if (err.response) {
            const returnObject = buildReturnObject(
                err.response.body.httpStatus,
                err.response.body.httpStatusCode,
                err.response.body.message + ' \\n ' + JSON.stringify(err.response.body.response.importSummaries)
            );
            return res.status(err.response.body.httpStatusCode).send(returnObject)
          }else {
            try {
              var error_obj = JSON.parse(err.message.split('responded with:', 2)[1]);
              const returnObject = buildReturnObject(
                  error_obj.body.httpStatus,
                  error_obj.body.httpStatusCode,
                  error_obj.body.message + " " + JSON.stringify(error_obj.body.response.conflicts)
              );
              return res.status(error_obj.body.httpStatusCode).send(returnObject)
            }catch {
              return err
            }
          }
        });
  } else {
    const returnObject = buildReturnObject('Failed', 404, {
      message: 'Trigger not found',
      url: req.url,
      method: req.method
    })
    res.status(404).send(returnObject)
  }
}
