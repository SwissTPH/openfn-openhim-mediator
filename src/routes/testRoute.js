'use strict'
//import {buildReturnObject} from './utils'
//const { Execute, Execute_noCLI } = require('../../core/lib/execute_noCLI');
var http = require('http');
const {VM} = require('vm2')

import openhim from '../openhim'
import logger from '../logger'
import {log} from 'async'
import {buildReturnObject} from './utils'


const openfnTrigger = function (state){
	let vm = new VM({sandbox: {state}})
    try{
		var trigger = vm.run(openhim.config.trigger)
	}catch(error) {
		logger.error(error)
	}
	return trigger;
}



const openfnJob = async (state) => {
  const {
	  Compile,
	  Execute,
	  transforms: { defaultTransforms, verify },
	  sandbox: { buildSandbox, VMGlobals },
	} = require('../../core/lib');

	const {
	  getModuleDetails,
	  formatCompileError,
	} = require('../../core/lib/utils');
  const code = openhim.config.job.expression
  const Adaptor = require(`../../languages/${openhim.config.job.language}`)
// Setup our initial global object, adding language packs and any other
// objects we want on our root.
const sandbox = buildSandbox({
    noConsole: false,
    testMode: false,
    extensions: [Adaptor],
  });
// Apply some transformations to the code (including a verify step) to
// check all function calls are valid.
	const compile = new Compile(code, [
		...defaultTransforms,
		verify({ sandbox: { ...sandbox, ...VMGlobals} }),
		]);
	if (compile.errors.length > 0) {
		throw new Error(
		  compile.errors.map(err => formatCompileError(code, err)).join('\n')
		);
	}
	try {
    // Run the expression and get the resulting state
    const finalState = await Execute({
      expression: compile.toString(),
      state,
      sandbox,
    });

    //writeJSON('/tmp/output.json', finalState);
  } catch (err) {
    console.error(err);
	throw err;
  }
  return finalState;
};
	
const makeResponse = function(state){
	if (state.references !== undefined && state.references.length !== 0) {
		// reply from distant server
		if (state.references[0].body) {
		  const returnObject = buildReturnObject(
			  state.references[0].body.httpStatus,
			  state.references[0].body.httpStatusCode,
			  state.references[0].body.message,
			  state
		  );
		  // conpleted but nothing done
		}else if (state.references[0].status === 'COMPLETED'){
		  const returnObject = buildReturnObject(
			  state.references[0].httpStatus? state.references[0].httpStatus : 'Completed',
			  state.references[0].httpStatusCode? state.references[0].httpStatusCode : 202,
			  state.references[0].message? state.references[0].message : 'A duplicate was found! No action taken',
			  state
		  );
		}
		//state modified
	}else if (state.body){
		const returnObject = buildReturnObject(
			state.body.httpStatus,
			state.body.httpStatusCode,
			state.body.message,
			state
		);
		
	}else{
		const returnObject = buildReturnObject(
			'Failed',
			500,
			{
				message: 'Mediator error: State has no body nor references'
			}
		);
	}
	return returnObject; 
}

const makeErrResponse = function(state, err){
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
		}else {
		const returnObject = buildReturnObject(
			err.response.body.httpStatus,
			err.response.body.httpStatusCode,
			err.response.body.message + ' \\n ' + JSON.stringify(err.response.body.response.importSummaries),
			err
		);
		}
	  }else if (err.message){
		if (typeof err.message === "string" && err.message.startsWith('responded')){
		  err = JSON.parse(err.message.split('responded with:', 2)[1]);
		  logger.error("Promise rejected with error: " + JSON.stringify(err))
		  const returnObject = buildReturnObject(
			  err.body.httpStatus,
			  err.body.httpStatusCode,
			  err.body.message,
			  err
		  );
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
			  }else {
				err = JSON.parse(err.response.text)
				const returnObject = buildReturnObject(
					err.httpStatus,
					err.httpStatusCode,
					err.message,
					err
				);
			  }
			}catch {
			  const returnObject = buildReturnObject(
				  "Failed",
				  500,
				  err.message,
				  err
			  );
			}
		}
	  } else{
		const returnObject = buildReturnObject(
			'Failed',
			500,
			{
				message: 'Mediator error: Unknown error'
			}
		);
	  }
	  
	  return returnObject;

}	

module.exports = async (_req, res) => {

  var state = {}
  state.data = _req.body
  var trigger = openfnTrigger(state)
  if(trigger){
	logger.info('---Event Triggered---')
	// define the loggin details
    state.configuration = {
      username: openhim.config.server.user,
      password: openhim.config.server.password,
      hostUrl: openhim.config.server.url
    }
	//run job (await means not async)
	try{
		state =  await openfnJob(state);
	}catch(err){
		returnObject =  makeErrResponse(state, err);
		return res.status(returnObject.response.status).send(returnObject) 
	}
	logger.info("---------");
	logger.info('Finished.');
	returnObject =  makeResponse(state);
	res.status(returnObject.response.status).send(returnObject)
  }else{
    const returnObject = buildReturnObject(
		'Failed', 
		409, 
		{
			message: 'Trigger did not activate, no action was performed.',
			url: _req.url,
			method: _req.method
		})
    res.status(409).send(returnObject)
  }
 
}

