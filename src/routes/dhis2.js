const winston = require('winston')
const request = require('request')
const utils = require('./utils')
const URI = require('urijs')
// eslint-disable-next-line no-unused-vars
const async = require('async')
const isJSON = require('is-json')

module.exports = function(dhisconfig) {
  const config = dhisconfig
  return {
    postData: function(body, orchestrations, callback) {
      if (isJSON(body)) {
        var url = new URI(config.url).segment('/api/dataValueSets')
        var username = config.username
        var password = config.password
        var auth =
          'Basic ' + new Buffer(username + ':' + password).toString('base64')
        var options = {
          url: url.toString(),
          body: body,
          headers: {
            Authorization: auth,
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        }
        let before = new Date()
        request.post(options, function(err, res, body) {
          orchestrations.push(
            utils.buildOrchestration(
              'Posting District data to DHIS2',
              before,
              'POST',
              url.toString(),
              JSON.stringify(options.headers),
              options.body,
              res,
              body
            )
          )
          return callback(err, res, body)
        })
      } else {
        winston.error('Non JSON data passed to function')
        return callback(err, res, false)
      }
    }
  }
}