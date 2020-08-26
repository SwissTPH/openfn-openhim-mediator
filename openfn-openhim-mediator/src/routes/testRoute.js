'use strict'

import logger from '../logger'
import {buildReturnObject} from './utils'
//import {execute} from 'core/lib/cli'
const Prepare = require('../../core/lib/prepare')

import fs from 'fs'
const {VM} = require('vm2')
import {execute as execute_dhis2} from 'language-dhis2/lib/Adaptor'
//import {execute as execute_omrs} from 'language-openmrs/lib/Adaptor'
//import {execute} from (openhim.config.job.language+'/lib/Adaptor')


import openhim from '../openhim'
const exec = require('child_process').exec
import config from '../openhim'
import * as path from 'path'

// The DHIS2 config is controlled via Environment Variables too to prevent ever having to
// risk committing sensitive data to source control
import {log} from 'async'

module.exports = (_req, res) => {
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
    // fs.writeFile('state.json', JSON.stringify(state), function(err) {
    //    if (err) return console.log(err)
    // })
    // fs.writeFile('expression.js', openhim.config.job.expression, function(err) {
    //   if (err) return console.log(err)
    // })
    //console.log(expression)

    // console.log("Execute was run ---------")
    // var command =
    //    `./core/lib/cli.js prepare -l ./languages/${openhim.config.job.language}.Adaptor -s `+ state +
    //    ' -o output.json -e '  + openhim.config.job.expression
    //  exec(command, {shell: '/bin/bash'} ,(error, stdout, stderr) => {
    //    console.log(`stdout: ${stdout}`)
    //    console.log("----------")
    //    console.log(error)
    //    console.log("----------")
    //    //console.log(error)
    //    if (error !== null) {
    //      // in case of error, send 400 code for bad request.
    //      const returnObject = buildReturnObject('Failed',
    //          400, {
    //        message: error,
    //        url: _req.url,
    //        method: _req.method
    //      })
    //      res.send(returnObject)
    //    } else {
    //      const returnObject = buildReturnObject(
    //       `stdout: SUCCESSFUL`,
    //        '200',
    //        'Test Endpoint Response!'
    //      )
    //      return res.send(returnObject)
    //    }
    //  })
    // var funct = openhim.config.job.expression
    // var temp = openhim.config.job.expression.split('({',1)[0]
    // let pos= temp.length+1; // +1 because of the parenthesis
    // try {
    //   let vm = new VM({sandbox: {state}})
    //   // -1 to remove the last parenthesis
    //   var newFunct = vm.run('newFunct = ' +funct.substr(pos, funct.length - pos - 1))
    // } catch (error) {
    //   console.log(error)
    //   logger.error(error)
    // }
    // //Execute({ne, state})
    // language['execute'](
    //     language[`${temp}`](newFunct)
    // )(state).then((result)=>{
    //   const returnObject = buildReturnObject(
    //       result.references[0].body.httpStatus,
    //       result.references[0].body.httpStatusCode,
    //       result.references[0].body.message
    //   )
    //   return res.send(returnObject)
    // })
    //     .catch((error) => {
    //       logger.error(error)
    //       const returnObject = buildReturnObject(
    //           'Failed',
    //           error.response.body.httpStatusCode,
    //           error.response.body.message
    //       )
    //       return res.send(returnObject)
    //     })
    var expression = openhim.config.job.expression
    var language = openhim.config.job.language
    Prepare(state,expression, language,res)
  }
}
