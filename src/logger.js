import pino, {stdSerializers} from 'pino'

import {LOG_LEVEL} from './config/config'

const logger = pino({
  level: LOG_LEVEL,
  prettyPrint: true,
  serializers: {
    err: stdSerializers.err
  }
})

module.exports = logger
