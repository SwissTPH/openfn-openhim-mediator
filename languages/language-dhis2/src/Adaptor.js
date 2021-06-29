/** @module Adaptor */
import axios from 'axios';
import {
  execute as commonExecute,
  composeNextState,
  expandReferences,
} from '@openfn/language-common';
import { indexOf } from 'lodash';

import {
  Log,
  warnExpectLargeResult,
  logWaitingForServer,
  buildUrl,
  logApiVersion,
  CONTENT_TYPES,
  applyFilter,
  parseFilter,
  logOperation,
  prettyJson,
} from './Utils';

/**
 * Execute a sequence of operations.
 * Wraps `language-common/execute`, and prepends initial state for DHIS2.
 * @example
 * execute(
 *   create('foo'),
 *   delete('bar')
 * )(state)
 * @constructor
 * @param {Operations} operations - Operations to be performed.
 * @returns {Operation}
 */
export function execute(...operations) {
  const initialState = {
    references: [],
    data: null,
  };

  return state => {
    return commonExecute(
      configMigrationHelper,
      ...operations
    )({ ...initialState, ...state });
  };
}

/**
 * Migrates `apiUrl` to `hostUrl` if `hostUrl` is `blank`.
 * For `OpenFn.org` users with the `old-style configuration`.
 * @example
 * configMigrationHelper(state)
 * @constructor
 * @param {object} state - the runtime state
 * @returns {object}
 */
function configMigrationHelper(state) {
  const { hostUrl, apiUrl } = state.configuration;
  if (!hostUrl) {
    Log.warn(
      'DEPRECATION WARNING: Please migrate instance address from `apiUrl` to `hostUrl`.'
    );
    state.configuration.hostUrl = apiUrl;
    return state;
  }
  return state;
}

axios.interceptors.response.use(
  function (response) {
    const contentType = response.headers['content-type']?.split(';')[0];

    const acceptHeaders = response.config.headers['Accept']
      .split(';')[0]
      .split(',');

    if (response.config.method === 'get') {
      if (indexOf(acceptHeaders, contentType) === -1) {
        const newError = {
          status: 404,
          message: 'Unexpected content,returned',
          responseData: response.data,
        };

        Log.error(newError.message);

        return Promise.reject(newError);
      }
    }

    if (
      typeof response?.data === 'string' &&
      contentType === CONTENT_TYPES?.json
    ) {
      try {
        response = { ...response, data: JSON.parse(response.data) };
      } catch (error) {
        /* Keep quiet */
      }
    }
    return response;
  },
  function (error) {
    Log.error(`${error?.message}`);
    return Promise.reject(JSON.stringify(error.response.data,null,2));
  }
);

/**
 * Get Tracked Entity Instance(s).
 * @public
 * @function
 * @param {Object} [params] - Optional `query parameters` e.g. `{ou: 'DiszpKrYNg8', filters: ['lZGmxYbs97q':GT:5']}`. Run `discover` or see {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html DHIS2 docs} for more details on which params to use when querying tracked entities instances.
 * @param {{apiVersion: number,responseType: string}} [options] - `Optional` options for `getTEIs` operation. Defaults to `{apiVersion: state.configuration.apiVersion, responseType: 'json'}`.
 * @param {function} [callback] - Optional callback to handle the response.
 * @returns {Operation}
 * @example <caption>- Example `getTEIs` `expression.js` for fetching a `single` `Tracked Entity Instance` with all the fields included.</caption>
 * getTEIs({
 *   fields: '*',
 *   ou: 'CMqUILyVnBL',
 *   trackedEntityInstance: 'HNTA9qD6EEG',
 *   skipPaging: true,
 * });
 */
export function getTEIs(params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'getTEIs';
    else {
      options = { operationName: 'getTEIs' };
    }

    return getData('trackedEntityInstances', params, options, callback)(state);
  };
}

/**
 * Update TEI if exists otherwise create.
 * - Update if the record exists otherwise insert a new record.
 * - This is useful for idempotency and duplicate record management.
 * @public
 * @function
 * @param {string} uniqueAttributeId - Tracked Entity Instance unique identifier attribute used during matching.
 * @param {Object} data - Payload data for new tracked entity instance or updated data for an existing tracked entity instance.
 * @param {{apiVersion: number,strict: boolean,responseType: string}} [options] - `Optional` options for `upsertTEI` operation. Defaults to `{apiVersion: state.configuration.apiVersion,strict: true,responseType: 'json'}`.
 * @param {function} [callback] - Optional `callback` to handle the response.
 * @throws {RangeError} - Throws `RangeError` when `uniqueAttributeId` is `invalid` or `not unique`.
 * @returns {Operation}
 * @example <caption>- Example `expression.js` for upserting a tracked entity instance on attribute with Id `lZGmxYbs97q`.</caption>
 * upsertTEI('lZGmxYbs97q', {
 *   orgUnit: 'TSyzvBiovKh',
 *   trackedEntityType: 'nEenWmSyUEp',
 *   attributes: [
 *     {
 *       attribute: 'lZGmxYbs97q',
 *       value: '77790012',
 *     },
 *     {
 *       attribute: 'w75KJ2mc4zz',
 *       value: 'Gigiwe',
 *     },
 *     {
 *       attribute: 'zDhUuAYrxNC',
 *       value: 'Mwanza',
 *     },
 *   ],
 * });
 */
export function upsertTEI(uniqueAttributeId, data, options, callback) {
  return state => {
    uniqueAttributeId = expandReferences(uniqueAttributeId)(state);

    const body = expandReferences(data)(state);

    options = expandReferences(options)(state);

    if (options) options.operationName = 'upsertTEI';
    else {
      options = { operationName: 'upsertTEI' };
    }

    const { password, username, hostUrl } = state.configuration;

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const strict = options?.strict ?? true;

    const params = {
      ou: body.orgUnit,
    };

    const uniqueAttributeValue = body.attributes?.find(
      obj => obj?.attribute === uniqueAttributeId
    )?.value;

    const trackedEntityType = body.trackedEntityType;

    const uniqueAttributeUrl = buildUrl(
      `/trackedEntityAttributes/${uniqueAttributeId}`,
      hostUrl,
      apiVersion
    );

    const trackedEntityTypeUrl = buildUrl(
      `/trackedEntityTypes/${trackedEntityType}?fields=*`,
      hostUrl,
      apiVersion
    );

    const findTrackedEntityType = () => {
      return axios
        .get(trackedEntityTypeUrl, { auth: { username, password } })
        .then(result => {
          const attribute = result.data?.trackedEntityTypeAttributes?.find(
            obj => obj?.trackedEntityAttribute?.id === uniqueAttributeId
          );
          return {
            ...result.data,
            upsertAttributeAssigned: attribute ? true : false,
          };
        });
    };

    const isAttributeUnique = () => {
      return axios
        .get(uniqueAttributeUrl, { auth: { username, password } })
        .then(result => {
          const foundAttribute = result.data;
          return { unique: foundAttribute.unique, name: foundAttribute.name };
        });
    };
    return Promise.all([
      findTrackedEntityType(),
      strict === true ? isAttributeUnique() : Promise.resolve({ unique: true }),
    ]).then(([entityType, attribute]) => {
      if (!entityType.upsertAttributeAssigned) {
        Log.error('');
        throw new RangeError(
          `Tracked Entity Attribute ${uniqueAttributeId} is not assigned to the ${entityType.name} Entity Type.`
        );
      }
      if (!attribute.unique) {
        Log.error('');
        throw new RangeError(
          `Attribute ${
            attribute.name ?? ''
          }(${uniqueAttributeId}) is not marked as unique.`
        );
      }
      return upsert(
        'trackedEntityInstances',
        {
          attributeId: uniqueAttributeId,
          attributeValue: uniqueAttributeValue,
        },
        body,
        params,
        options,
        callback
      )(state);
    });
  };
}

/**
 * Create Tracked Entity Instance.
 * @public
 * @function
 * @param {Object} data - The update data containing new values.
 * @param {Object} [params] - Optional `import parameters` for a given a resource. E.g. `{dryRun: true, importStrategy: CREATE}` See {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#import-parameters_1 DHIS2 Import parameters documentation} or run `discover`. Defauls to `DHIS2 default import parameters`.
 * @param {{apiVersion: number,responseType: string}} [options] - `Optional` options for `createTEI` operation. Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`.
 * @param {function} [callback] - Optional callback to handle the response.
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `createTEI`.</caption>
 * createTEI({
 *    orgUnit: 'TSyzvBiovKh',
 *    trackedEntityType: 'nEenWmSyUEp',
 *    attributes: [
 *       {
 *          attribute: 'lZGmxYbs97q',
 *          value: valUpsertTEI,
 *       },
 *       {
 *          attribute: 'w75KJ2mc4zz',
 *          value: 'Gigiwe',
 *       },
 *    ],
 *    enrollments: [
 *       {
 *          orgUnit: 'TSyzvBiovKh',
 *          program: 'fDd25txQckK',
 *          programState: 'lST1OZ5BDJ2',
 *          enrollmentDate: '2021-01-04',
 *          incidentDate: '2021-01-04',
 *       },
 *    ],
 * });
 */
export function createTEI(data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'createTEI';
    else {
      options = { operationName: 'createTEI' };
    }

    return create(
      'trackedEntityInstances',
      data,
      params,
      options,
      callback
    )(state);
  };
}

/**
 * Update a Tracked Entity Instance.
 * @public
 * @function
 * @param {string} path - Path to the object being updated. This can be an `id` or path to an `object` in a `nested collection` on the object(E.g. `/api/{collection-object}/{collection-object-id}/{collection-name}/{object-id}`).
 * @param {Object} data - The update data containing new values.
 * @param {Object} [params] - Optional `import parameters` for a given a resource. E.g. `{dryRun: true, importStrategy: CREATE, filters:[]}` See {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#import-parameters_1 DHIS2 Import parameters documentation} or run `discover`. Defauls to `DHIS2 default import parameters`.
 * @param {{apiVersion: number,responseType: string}} [options] - `Optional` options for `updateTEI` operation. Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`.
 * @param {function} [callback] - Optional callback to handle the response.
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `updateTEI`.</caption>
 * updateTEI('PVqUD2hvU4E', {
 *    orgUnit: 'TSyzvBiovKh',
 *    trackedEntityType: 'nEenWmSyUEp',
 *    attributes: [
 *       {
 *          attribute: 'lZGmxYbs97q',
 *          value: valUpsertTEI,
 *       },
 *       {
 *          attribute: 'w75KJ2mc4zz',
 *          value: 'Gigiwe',
 *       },
 *    ],
 *    enrollments: [
 *       {
 *          orgUnit: 'TSyzvBiovKh',
 *          program: 'fDd25txQckK',
 *          programState: 'lST1OZ5BDJ2',
 *          enrollmentDate: '2021-01-04',
 *          incidentDate: '2021-01-04',
 *       },
 *    ],
 * });
 */
export function updateTEI(path, data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);
    if (options) options.operationName = 'updateTEI';
    else {
      options = { operationName: 'updateTEI' };
    }
    return update(
      'trackedEntityInstances',
      path,
      data,
      params,
      options,
      callback
    )(state);
  };
}

/**
 * Get annonymous events or tracker events.
 * @public
 * @function
 * @param {Object} params - `import` parameters for `getEvents`. See examples here
 * @param {{apiVersion: number,responseType: string}} [options] - `Optional` options for `getEvents` operation. Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`.
 * @param {function} [callback] - Optional callback to handle the response.
 * @returns {Operation}
 * @example <caption>- Query for `all events` with `children` of a certain `organisation unit`</caption>
 * getEvents({ orgUnit: 'YuQRtpLP10I', ouMode: 'CHILDREN' });
 */
export function getEvents(params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'getEvents';
    else {
      options = { operationName: 'getEvents' };
    }
    return getData('events', params,  options, callback)(state);
  };
}

/**
 * Create DHIS2 Events
 * - You will need a `program` which can be looked up using the `getPrograms` operation, an `orgUnit` which can be looked up using the `getMetadata` operation and passing `{organisationUnits: true}` as `resources` param, and a list of `valid data element identifiers` which can be looked up using the `getMetadata` passing `{dataElements: true}` as `resources` param.
 * - For events with registration, a `tracked entity instance identifier is required`
 * - For sending `events` to `programs with multiple stages`, you will need to also include the `programStage` identifier, the identifiers for `programStages` can be found in the `programStages` resource via a call to `getMetadata` operation.
 * @public
 * @function
 * @param {Object} data - The payload containing new values
 * @param {Object} [params] - Optional `import parameters` for events. E.g. `{dryRun: true, importStrategy: CREATE, filters:[]}` See {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#events DHIS2 Event Import parameters documentation} or run `discover`. Defauls to `DHIS2 default import parameters`.
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `createEvents` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation} state
 * @example <caption>- Example `expression.js` of `createEvents` for a `single event` can look like this:</caption>
 * createEvents({
 *   program: 'eBAyeGv0exc',
 *   orgUnit: 'DiszpKrYNg8',
 *   eventDate: date,
 *   status: 'COMPLETED',
 *   completedDate: date,
 *   storedBy: 'admin',
 *   coordinate: {
 *     latitude: 59.8,
 *     longitude: 10.9,
 *   },
 *   dataValues: [
 *     {
 *       dataElement: 'qrur9Dvnyt5',
 *       value: '33',
 *     },
 *     {
 *       dataElement: 'oZg33kd9taw',
 *       value: 'Male',
 *     },
 *     {
 *       dataElement: 'msodh3rEMJa',
 *       value: date,
 *     },
 *   ],
 * });
 */
export function createEvents(data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'createEvents';
    else {
      options = { operationName: 'createEvents' };
    }
    return create('events', data, params, options, callback)(state);
  };
}

/**
 * Update DHIS2 Event.
 * - To update an existing event, the format of the payload is the same as that of `creating an event` via `createEvents` operations
 * - But you should supply the `identifier` of the object you are updating
 * - The payload has to contain `all`, even `non-modified`, `attributes`.
 * - Attributes that were present before and are not present in the current payload any more will be removed by DHIS2.
 * - If you do not want this behavior, please use `upsert` operation to upsert your events.
 * @public
 * @function
 * @param {string} path - Path to the object being updated. This can be an `id` or path to an `object` in a `nested collection` on the object(E.g. `/api/{collection-object}/{collection-object-id}/{collection-name}/{object-id}`)
 * @param {Object} data - The update data containing new values
 * @param {Object} [params] - Optional `import` parameters for `updateEvents`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `updateEvents` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `updateEvents`</caption>
 * updateEvents('PVqUD2hvU4E', { events: [
 *  {
 *    program: 'eBAyeGv0exc',
 *    orgUnit: 'DiszpKrYNg8',
 *    eventDate: date,
 *    status: 'COMPLETED',
 *    storedBy: 'admin',
 *    coordinate: {
 *      latitude: '59.8',
 *      longitude: '10.9',
 *    },
 *    dataValues: [
 *      {
 *        dataElement: 'qrur9Dvnyt5',
 *        value: '22',
 *      },
 *      {
 *        dataElement: 'oZg33kd9taw',
 *        value: 'Male',
 *      },
 *    ],
 *  }]
 * });
 */
export function updateEvents(path, data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'updateEvents';
    else {
      options = { operationName: 'updateEvents' };
    }
    return update('events', path, data, params, options, callback)(state);
  };
}

/**
 * Get DHIS2 Tracker Programs.
 * @public
 * @function
 * @param {Object} params - `import` parameters for `getPrograms`. See {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#tracker-web-api DHIS2 api documentation for allowed query parameters }
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `getPrograms` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Query for `all programs` with a certain `organisation unit`</caption>
 * getPrograms({ orgUnit: 'DiszpKrYNg8' , fields: '*' });
 */
export function getPrograms(params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'getPrograms';
    else {
      options = { operationName: 'getPrograms' };
    }
    return getData('programs', params, options, callback)(state);
  };
}

/**
 * Create a DHIS2 Tracker Program
 * @public
 * @function
 * @param {Object} data - The update data containing new values
 * @param {Object} [params] - Optional `import` parameters for `createPrograms`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `getPrograms` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `createPrograms` for a `single program` can look like this:</caption>
 * createPrograms(state.data);
 */
export function createPrograms(data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'createPrograms';
    else {
      options = { operationName: 'createPrograms' };
    }
    return create('programs', data, options, params, callback)(state);
  };
}

/**
 * Update DHIS2 Tracker Programs
 * - To update an existing program, the format of the payload is the same as that of `creating an event` via `createEvents` operations
 * - But  you should supply the `identifier` of the object you are updating
 * - The payload has to contain `all`, even `non-modified`, `attributes`.
 * - Attributes that were present before and are not present in the current payload any more will be removed by DHIS2.
 * - If you do not want this behavior, please use `upsert` operation to upsert your events.
 * @public
 * @function
 * @param {string} path - Path to the object being updated. This can be an `id` or path to an `object` in a `nested collection` on the object(E.g. `/api/{collection-object}/{collection-object-id}/{collection-name}/{object-id}`)
 * @param {Object} data - The update data containing new values
 * @param {Object} [params] - Optional `import` parameters for `updatePrograms`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `getPrograms` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `updatePrograms`</caption>
 * updatePrograms('PVqUD2hvU4E', state.data);
 */
export function updatePrograms(path, data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);
    if (options) options.operationName = 'updatePrograms';
    else {
      options = { operationName: 'updatePrograms' };
    }
    return update('programs', path, data, params, options, callback)(state);
  };
}

/**
 * Get DHIS2 Enrollments
 * @public
 * @function
 * @param {Object} params - `Query` parameters for `getEnrollments`. See {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#enrollment-management  here}
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `getEnrollments` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- To constrain the response to `enrollments` which are part of a `specific program` you can include a `program query parameter`</caption>
 * getEnrollments({
 *   ou: 'O6uvpzGd5pu',
 *   ouMode: 'DESCENDANTS',
 *   program: 'ur1Edk5Oe2n',
 *   fields: '*',
 * });
 */
export function getEnrollments(params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'getEnrollments';
    else {
      options = { operationName: 'getEnrollments' };
    }
    return getData('enrollments', params, options, callback)(state);
  };
}

/**
 * Enroll a TEI into a program
 * - Enrolling a tracked entity instance into a program
 * - For enrolling `persons` into a `program`, you will need to first get the `identifier of the person` from the `trackedEntityInstances resource` via the `getTEIs` operation.
 * - Then, you will need to get the `program identifier` from the `programs` resource via the `getPrograms` operation.
 * @public
 * @function
 * @param {Object} data - The enrollment data. See example {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#enrollment-management here }
 * @param {Object} [params] - Optional `import` parameters for `createEnrollment`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `enrollTEI` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `createEnrollment` of a `person` into a `program` can look like this:</caption>
 * enrollTEI({
 *    trackedEntity: 'tracked-entity-id',
 *    orgUnit: 'org-unit-id',
 *    attributes: [
 *    {
 *       attribute: 'attribute-id',
 *       value: 'attribute-value',
 *    },
 *    ],
 *    enrollments: [
 *    {
 *       orgUnit: 'org-unit-id',
 *       program: 'program-id',
 *       enrollmentDate: '2013-09-17',
 *       incidentDate: '2013-09-17',
 *    },
 *    ],
 *});
 */
export function enrollTEI(data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);
    if (options) options.operationName = 'enrollTEI';
    else {
      options = { operationName: 'enrollTEI' };
    }
    return create('enrollments', data, options, params, callback)(state);
  };
}

/**
 * Update a DHIS2 Enrollemts
 * - To update an existing enrollment, the format of the payload is the same as that of `creating an event` via `createEvents` operations
 * - But  you should supply the `identifier` of the object you are updating
 * - The payload has to contain `all`, even `non-modified`, `attributes`.
 * - Attributes that were present before and are not present in the current payload any more will be removed by DHIS2.
 * - If you do not want this behavior, please use `upsert` operation to upsert your events.
 * @public
 * @function
 * @param {string} path - Path to the object being updated. This can be an `id` or path to an `object` in a `nested collection` on the object(E.g. `/api/{collection-object}/{collection-object-id}/{collection-name}/{object-id}`)
 * @param {Object} data - The update data containing new values
 * @param {Object} [params] - Optional `import` parameters for `updateEnrollments`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `updateEnrollments` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `updateEnromments`</caption>
 * updateEnrollments('PVqUD2hvU4E', state.data);
 */
export function updateEnrollments(path, data, params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'updateEnrollments';
    else {
      options = { operationName: 'updateEnrollments' };
    }
    return update('enrollments', path, data, params, options, callback)(state);
  };
}

/**
 * Cancel a DHIS2 Enrollment
 * - To cancel an existing enrollment, you should supply the `enrollment identifier`(`enrollemt-id`)
 * @public
 * @function
 * @param {string} enrollmentId - The `enrollment-id` of the enrollment you wish to cancel
 * @param {Object} [params] - Optional `import` parameters for `cancelEnrollment`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `cancelEnrollment` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `cancelEnrollment`</caption>
 * cancelEnrollments('PVqUD2hvU4E');
 */
export function cancelEnrollment(enrollmentId, params, options, callback) {
  return state => {
    enrollmentId = expandReferences(enrollmentId)(state);

    options = expandReferences(options)(state);

    if (options) options.operationName = 'cancelEnrollment';
    else {
      options = { operationName: 'cancelEnrollment' };
    }

    const path = `${enrollmentId}/cancelled`;

    return update('enrollments', path, null, params, options, callback)(state);
  };
}

/**
 * Complete a DHIS2 Enrollment
 * - To complete an existing enrollment, you should supply the `enrollment identifier`(`enrollemt-id`)
 * @public
 * @function
 * @param {string} enrollmentId - The `enrollment-id` of the enrollment you wish to cancel
 * @param {Object} [params] - Optional `import` parameters for `completeEnrollment`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `completeEnrollment` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `completeEnrollment`</caption>
 * completeEnrollment('PVqUD2hvU4E');
 */
export function completeEnrollment(enrollmentId, params, options, callback) {
  return state => {
    enrollmentId = expandReferences(enrollmentId)(state);

    options = expandReferences(options)(state);

    if (options) options.operationName = 'completeEnrollment';
    else {
      options = { operationName: 'completeEnrollment' };
    }

    const path = `${enrollmentId}/completed`;

    return update('enrollments', path, null, params, options, callback)(state);
  };
}

/**
 * Get DHIS2 Relationships(links) between two entities in tracker. These entities can be tracked entity instances, enrollments and events.
 * - All the tracker operations, `getTEIs`, `getEnrollments` and `getEvents` also list their relationships if requested in the `field` filter.
 * - To list all relationships, this requires you to provide the UID of the trackedEntityInstance, Enrollment or event that you want to list all the relationships for.
 * @public
 * @function
 * @param {Object} params - `Query` parameters for `getRelationships`. See examples {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#relationships here}
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `getRelationships` operation.Defaults to `{apiVersion: state.configuration.apiVersion,responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- A query for `all relationships` associated with a `specific tracked entity instance` can look like this:</caption>
 * getRelationships({ tei: 'F8yKM85NbxW', fields: '*' });
 */
export function getRelationships(params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'getRelationships';
    else {
      options = { operationName: 'getRelationships' };
    }

    return getData('relationships', params, options, callback)(state);
  };
}

/**
 * Get DHIS2 Data Values.
 * - This operation retrives data values from DHIS2 Web API by interacting with the `dataValueSets` resource
 * - Data values can be retrieved in XML, JSON and CSV format.
 * @public
 * @function
 * @param {Object} params - `Query` parameters for `getDataValues`. E.g. `{dataset: 'pBOMPrpg1QX', limit: 3, period: 2021, orgUnit: 'DiszpKrYNg8'} Run `discover` or see {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#data-values DHIS2 API docs} for available `Data Value Set Query Parameters`.
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `options` for `getDataValues` operation. Defaults to `{apiVersion: state.configuration.apiVersion, responseType: 'json'}`
 * @param {function} [callback] - Optional `callback` to handle the response
 * @returns {Operation}
 * @example <caption>- Example getting **two** `data values` associated with a specific `orgUnit`, `dataSet`, and `period `</caption>
 * getDataValues({
 *   orgUnit: 'DiszpKrYNg8',
 *   period: '202010',
 *   dataSet: 'pBOMPrpg1QX',
 *   limit: 2,
 * });
 */
export function getDataValues(params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'getDataValues';
    else {
      options = { operationName: 'getDataValues' };
    }

    return getData('dataValueSets', params, options, callback)(state);
  };
}

/**
 * Create DHIS2 Data Values
 * - This is used to send aggregated data to DHIS2
 * - A data value set represents a set of data values which have a relationship, usually from being captured off the same data entry form.
 * - To send a set of related data values sharing the same period and organisation unit, we need to identify the period, the data set, the org unit (facility) and the data elements for which to report.
 * - You can also use this operation to send large bulks of data values which don't necessarily are logically related.
 * - To send data values that are not linked to a `dataSet`, you do not need to specify the dataSet and completeDate attributes. Instead, you will specify the period and orgUnit attributes on the individual data value elements instead of on the outer data value set element. This will enable us to send data values for various periods and organisation units
 * @public
 * @function
 * @param {object} data - The `data values` to upload or create. See example shape.
 * @param {{apiVersion: number,responseType: string}} [options] - Optional `flags` for the behavior of the `createDataVaues` operation.
 * @param {object} [params] - Optional `import` parameters for `createDataValues`. E.g. `{dryRun: true, IdScheme: 'CODE'}. Defaults to DHIS2 `default params`. Run `discover` or visit {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#data-values DHIS2 Docs API} to learn about available data values import parameters.
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `createDataValues`  for sending a set of related data values sharing the same period and organisation unit</caption>
 * createDataValues({
 *   dataSet: 'pBOMPrpg1QX',
 *   completeDate: '2014-02-03',
 *   period: '201401',
 *   orgUnit: 'DiszpKrYNg8',
 *   dataValues: [
 *     {
 *       dataElement: 'f7n9E0hX8qk',
 *       value: '1',
 *     },
 *     {
 *       dataElement: 'Ix2HsbDMLea',
 *       value: '2',
 *     },
 *     {
 *       dataElement: 'eY5ehpbEsB7',
 *       value: '3',
 *     },
 *   ],
 * });
 */
export function createDataValues(data, options, params, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'createDataValues';
    else {
      options = { operationName: 'createDataValues' };
    }
    return create('dataValueSets', data, options, params, callback)(state);
  };
}

/**
 * Generate valid, random DHIS2 identifiers
 * - Useful for client generated Ids compatible with DHIS2
 * @public
 * @function
 * @param {{apiVersion: number,limit: number,responseType: string}} [options] - Optional `options` for `generateDhis2UID` operation. Defaults to `{apiVersion: state.configuration.apiVersion,limit: 1,responseType: 'json'}`
 * @param {function} [callback] - Callback to handle response
 * @returns {Operation}
 * @example <caption>Example generating `three UIDs` from the DHIS2 server</caption>
 * generateDhis2UID({limit: 3});
 */
export function generateDhis2UID(options, callback) {
  return state => {
    options = expandReferences(options)(state);
    if (options) options.operationName = 'generateDhis2UID';
    else {
      options = { operationName: 'generateDhis2UID' };
    }
    const limit = { limit: options?.limit ?? 1 };

    delete options?.limit;

    return getData('system/id', limit, options, callback)(state);
  };
}

/**
 * Discover `DHIS2` `api` `endpoint` `query parameters` and allowed `operators` for a given resource's endpoint.
 * @public
 * @function
 * @param {string} httpMethod - The HTTP to inspect parameter usage for a given endpoint, e.g., `get`, `post`,`put`,`patch`,`delete`
 * @param {string} endpoint - The path for a given endpoint. E.g. `/trackedEntityInstances` or `/dataValueSets`
 * @returns {Operation}
 * @example <caption>Example getting a list of `parameters allowed` on a given `endpoint` for specific `http method`</caption>
 * discover('post', '/trackedEntityInstances')
 */
export function discover(httpMethod, endpoint) {
  return state => {
    Log.info(
      `Discovering query/import parameters for ${httpMethod} on ${endpoint}`
    );
    return axios
      .get(
        'https://dhis2.github.io/dhis2-api-specification/spec/metadata_openapi.json',
        {
          transformResponse: [
            data => {
              let tempData = JSON.parse(data);
              let filteredData = tempData.paths[endpoint][httpMethod];
              return {
                ...filteredData,
                parameters: filteredData.parameters.reduce(
                  (acc, currentValue) => {
                    let index = currentValue['$ref'].lastIndexOf('/') + 1;
                    let paramRef = currentValue['$ref'].slice(index);
                    let param = tempData.components.parameters[paramRef];

                    if (param.schema['$ref']) {
                      let schemaRefIndex =
                        param.schema['$ref'].lastIndexOf('/') + 1;
                      let schemaRef = param.schema['$ref'].slice(
                        schemaRefIndex
                      );
                      param.schema = tempData.components.schemas[schemaRef];
                    }

                    param.schema = JSON.stringify(param.schema);

                    let descIndex;
                    if (
                      indexOf(param.description, ',') === -1 &&
                      indexOf(param.description, '.') > -1
                    )
                      descIndex = indexOf(param.description, '.');
                    else if (
                      indexOf(param.description, ',') > -1 &&
                      indexOf(param.description, '.') > -1
                    ) {
                      descIndex =
                        indexOf(param.description, '.') <
                        indexOf(param.description, ',')
                          ? indexOf(param.description, '.')
                          : indexOf(param.description, ',');
                    } else {
                      descIndex = param.description.length;
                    }

                    param.description = param.description.slice(0, descIndex);

                    acc[paramRef] = param;
                    return acc;
                  },
                  {}
                ),
              };
            },
          ],
        }
      )
      .then(result => {
        Log.info(
          `\t=======================================================================================\n\tQuery Parameters for ${httpMethod} on ${endpoint} [${
            result.data.description ?? '<description_missing>'
          }]\n\t=======================================================================================`
        );
        console.table(result.data.parameters, [
          'in',
          'required',
          'description',
        ]);
        console.table(result.data.parameters, ['schema']);
        console.log(
          `=========================================Responses===============================\n${prettyJson(
            result.data.responses
          )}\n=======================================================================================`
        );
        return { ...state, data: result.data };
      });
  };
}

/**
 * Get analytical, aggregated data
 * - The analytics resource is powerful as it lets you query and retrieve data aggregated along all available data dimensions.
 * - For instance, you can ask the analytics resource to provide the aggregated data values for a set of data elements, periods and organisation units.
 * - Also, you can retrieve the aggregated data for a combination of any number of dimensions based on data elements and organisation unit group sets.
 * @public
 * @function
 * @param {Object} params - Analytics `query parameters`, e.g. `{dx: 'fbfJHSPpUQD;cYeuwXTCPkU',filters: ['pe:2014Q1;2014Q2','ou:O6uvpzGd5pu;lc3eMKXaEfw']}`. Run `discover` or visit {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#analytics DHIS2 API docs} to get the params available.
 * @param {{apiVersion: number,responseType: string}}[options] - `Optional` options for `getAnalytics` operation. Defaults to `{apiVersion: state.configuration.apiVersion, responseType: 'json'}`.
 * @param {function} [callback] - Callback to handle response
 * @returns {Operation}
 * @example <caption>Example getting only records where the data value is greater or equal to 6500 and less than 33000</caption>
 * getAnalytics({
 *   dimensions: [
 *    'dx:fbfJHSPpUQD;cYeuwXTCPkU',
 *    'pe:2014',
 *    'ou:O6uvpzGd5pu;lc3eMKXaEfw',
 *   ],
 *   measureCriteria: 'GE:6500;LT:33000',
 * });
 */
export function getAnalytics(params, options, callback) {
  return state => {
    options = expandReferences(options)(state);

    if (options) options.operationName = 'getAnalytics';
    else {
      options = { operationName: 'getAnalytics' };
    }
    return getData(`analytics`, params, options, callback)(state);
  };
}

/**
 * Get DHIS2 api resources
 * @public
 * @function
 * @param {Object} [params] - The `optional` query parameters for this endpoint. E.g `{filter: 'singular:like:attribute'}`.
 * @param {{filter: string, fields: string, responseType: string}} [options] - The `optional` options, specifiying the filter expression. E.g. `singular:eq:attribute`.
 * @param {function} [callback] - The `optional callback function that will be called to handle data returned by this function.
 * @returns {Operation}
 * @example <caption>Example getting a resource named `attribute`, in `xml` format, returning all the fields</caption>
 * getResources('dataElement', {
 *      filter: 'singular:eq:attribute',
 *      fields: '*',
 *      responseType: 'xml',
 * });
 */
export function getResources(params, options, callback) {
  return state => {
    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const operationName = 'getResources';

    const { username, password, hostUrl } = state.configuration;

    const responseType = options?.responseType ?? 'json';

    const filter = params?.filter;

    const queryParams = params;

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    const path = '/resources';

    const url = buildUrl(path, hostUrl, null, false);

    const transformResponse = function (data, headers) {
      if (filter) {
        if (
          (headers['content-type']?.split(';')[0] ?? null) ===
          CONTENT_TYPES.json
        ) {
          let tempData = JSON.parse(data);
          return {
            ...tempData,
            resources: applyFilter(tempData.resources, ...parseFilter(filter)),
          };
        } else {
          Log.warn(
            'Filters on this resource are only supported for json content types. Skipping filtering ...'
          );
        }
      }
      return data;
    };

    logOperation(operationName);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(queryParams, url);

    return axios
      .request({
        url,
        method: 'GET',
        auth: { username, password },
        responseType,
        headers,
        params: queryParams,
        transformResponse,
      })
      .then(result => {
        Log.info(
          `${operationName} succeeded. The result of this operation will be in ${operationName} state.data or in your ${operationName} callback.`
        );
        if (callback) return callback(composeNextState(state, result.data));
        return composeNextState(state, result.data);
      });
  };
}

/**
 * Get schema of a given resource type, in any data format supported by DHIS2
 * @public
 * @function
 * @param {string} resourceType - The type of resource to be updated(`singular` version of the `resource name`). E.g. `dataElement`, `organisationUnit`, etc. Run `getResources` to see available resources and their corresponding `singular` names.
 * @param {Object} params - Optional `query parameters` for the `getSchema` operation. e.g. `{ fields: 'properties' ,skipPaging: true}`. Run`discover` or See {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#metadata-export-examples DHIS2 API Docs}
 * @param {{apiVersion: number,resourceType: string}} [options] - Optional options for `getSchema` method. Defaults to `{apiVersion: state.configuration.apiVersion, responseType: 'json'}`
 * @param {function} [callback] - Optional `callback` to handle the response
 * @returns {Operation}
 * @example <caption>Example getting the `schema` for `dataElement` in XML</caption>
 * getSchema('dataElement', '{ fields: '*' }, { responseType: 'xml' });
 */
export function getSchema(resourceType, params, options, callback) {
  return state => {
    resourceType = expandReferences(resourceType)(state);

    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const operationName = 'getSchema';

    const { username, password, hostUrl } = state.configuration;

    const responseType = options?.responseType ?? 'json';

    const filters = params?.filters;

    delete params?.filters;

    let queryParams = new URLSearchParams(params);

    filters?.map(f => queryParams.append('filter', f));

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    const url = buildUrl(`/schemas/${resourceType ?? ''}`, hostUrl, apiVersion);

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(resourceType, url);

    return axios
      .request({
        method: 'GET',
        url,
        auth: {
          username,
          password,
        },
        responseType,
        params: queryParams,
        headers,
      })
      .then(result => {
        Log.info(
          `${operationName} succeeded. The result of this operation will be in ${operationName} state.data or in your ${operationName} callback.`
        );
        if (callback) return callback(composeNextState(state, result.data));
        return composeNextState(state, result.data);
      });
  };
}

/**
 * Get data. Generic helper method for getting data of any kind from DHIS2.
 * - This can be used to get `DataValueSets`,`events`,`trackedEntityInstances`,`etc.`
 * @public
 * @function
 * @param {string} resourceType - The type of resource to get(use its `plural` name). E.g. `dataElements`, `trackedEntityInstances`,`organisationUnits`, etc.
 * @param {Object} [params] - Optional `query parameters` e.g. `{ou: 'DiszpKrYNg8'}`. Run `discover` or see {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html DHIS2 docs} for more details on which params to use for a given type of resource.
 * @param {{apiVersion: number,operationName: string,responseType: string}}[options] - `Optional` options for `getData` operation. Defaults to `{operationName: 'getData', apiVersion: state.configuration.apiVersion, responseType: 'json'}`.
 * @param {function} [callback]  - Optional callback to handle the response
 * @returns {Operation} state
 * @example <caption>Example getting one `trackedEntityInstance` with `Id` 'dNpxRu1mWG5' for a given `orgUnit(DiszpKrYNg8)`</caption>
 * getData('trackedEntityInstances', {
 *    fields: '*',
 *    ou: 'DiszpKrYNg8',
 *    entityType: 'nEenWmSyUEp',
 *    trackedEntityInstance: 'dNpxRu1mWG5',
 * });
 */
export function getData(resourceType, params, options, callback) {
  return state => {
    resourceType = expandReferences(resourceType)(state);

    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const operationName = options?.operationName ?? 'getData';

    const { username, password, hostUrl } = state.configuration;

    const responseType = options?.responseType ?? 'json';

    const filters = params?.filters;

    const dimensions = params?.dimensions;

    delete params?.filters;

    let queryParams = new URLSearchParams(params);

    filters?.map(f => queryParams.append('filter', f));

    dimensions?.map(d => queryParams.append('dimension', d));

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    const url = buildUrl(`/${resourceType}`, hostUrl, apiVersion);

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(resourceType, url);

    return axios
      .request({
        method: 'GET',
        url,
        auth: {
          username,
          password,
        },
        responseType,
        params: queryParams,
        headers,
      })
      .then(result => {
        Log.info(
          `${operationName} succeeded. The result of this operation will be in ${operationName} state.data or in your callback.`
        );
        if (callback) return callback(composeNextState(state, result.data));
        return composeNextState(state, result.data);
      });
  };
}

/**
 * Get metadata. A generic helper function to get metadata records from a given DHIS2 instance
 * @public
 * @function
 * @param {string[]} resources - Required. List of metadata resources to fetch. E.g. `['organisationUnits', 'attributes']` or like `'dataSets'` if you only want a single type of resource. See `getResources` to see the types of resources available.
 * @param {Object} [params] - Optional `query parameters` e.g. `{filters: ['name:like:ANC'],fields:'*'}`. See `discover` or visit {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#metadata-export DHIS2 API docs}
 * @param {{apiVersion: number,operationName: string,resourceType: string}} [options] - Optional `options` for `getMetadata` operation. Defaults to `{operationName: 'getMetadata', apiVersion: state.configuration.apiVersion, responseType: 'json'}`
 * @param {function} [callback] - Optional `callback` to handle the response
 * @returns {Operation}
 * @example <caption>Example getting a list of `data elements` and `indicators` where `name` includes the word **ANC**</caption>
 * getMetadata(['dataElements', 'indicators'], {
 *      filters: ['name:like:ANC'],
 * });
 */
export function getMetadata(resources, params, options, callback) {
  return state => {
    resources = expandReferences(resources)(state);

    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const operationName = 'getMetadata';

    const { username, password, hostUrl } = state.configuration;

    const responseType = options?.responseType ?? 'json';

    if (typeof resources === 'string') {
      let res = {};
      res[resources] = true;
      resources = res;
    } else {
      resources = resources.reduce((acc, currentValue) => {
        acc[currentValue] = true;
        return acc;
      }, {});
    }

    let queryParams = {
      ...resources,
      ...params,
    };

    const filters = queryParams?.filters;

    delete queryParams?.filters;

    queryParams = new URLSearchParams(queryParams);

    filters?.map(f => queryParams.append('filter', f));

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    const url = buildUrl('/metadata', hostUrl, apiVersion);

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(queryParams, url);

    return axios
      .request({
        method: 'GET',
        url,
        auth: {
          username,
          password,
        },
        responseType,
        params: queryParams,
        headers,
      })
      .then(result => {
        Log.info(
          `${operationName} succeeded. The result of this operation will be in ${operationName} state.data or in your callback.`
        );
        if (callback) return callback(composeNextState(state, result.data));
        return composeNextState(state, result.data);
      });
  };
}

/**
 * create data. A generic helper method to create a record of any kind in DHIS2
 * @public
 * @function
 * @param {string} resourceType - Type of resource to create. E.g. `trackedEntityInstances`
 * @param {Object} data - Data that will be used to create a given instance of resource
 * @param {Object} [options] - Optional `options` to control the behavior of the `create` operation.` Defaults to `{operationName: 'create', apiVersion: null, responseType: 'json'}`
 * @param {Object} [params] - Optional `import parameters` for a given a resource. E.g. `{dryRun: true, importStrategy: CREATE}` See {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html DHIS2 API documentation} or {@link discover}. Defauls to `DHIS2 default params` for a given resource type.
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of `create`</caption>
 * create('events', {
 *   program: 'eBAyeGv0exc',
 *   orgUnit: 'DiszpKrYNg8',
 *   eventDate: date,
 *   status: 'COMPLETED',
 *   completedDate: date,
 *   storedBy: 'admin',
 *   coordinate: {
 *     latitude: 59.8,
 *     longitude: 10.9,
 *   },
 *   dataValues: [
 *     {
 *       dataElement: 'qrur9Dvnyt5',
 *       value: '33',
 *     },
 *     {
 *       dataElement: 'oZg33kd9taw',
 *       value: 'Male',
 *     },
 *     {
 *       dataElement: 'msodh3rEMJa',
 *       value: date,
 *     },
 *   ],
 * });
 */
export function create(resourceType, data, options, params, callback) {
  return state => {
    resourceType = expandReferences(resourceType)(state);

    const body = expandReferences(data)(state);

    options = expandReferences(options)(state);

    params = expandReferences(params)(state);

    const operationName = options?.operationName ?? 'create';

    const { username, password, hostUrl } = state.configuration;

    const responseType = options?.responseType ?? 'json';

    const filters = params?.filters;

    delete params?.filters;

    let queryParams = new URLSearchParams(params);

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const url = buildUrl('/' + resourceType, hostUrl, apiVersion);

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
      'Content-Type': 'application/json',
    };

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(resourceType, url);

    return axios
      .request({
        method: 'POST',
        url,
        auth: {
          username,
          password,
        },
        params: queryParams,
        data: body,
        headers,
      })
      .then(result => {
        Log.info(
          `${operationName} succeeded. Created ${resourceType}: ${
            result.data.response?.importSummaries
              ? result.data.response.importSummaries[0].href
              : result.data.response?.reference
          }.\nSummary:\n${prettyJson(result.data)}`
        );
        if (callback) return callback(composeNextState(state, result.data));
        return composeNextState(state, result.data);
      });
  };
}

/**
 * Update data. A generic helper function to update a resource object of any type.
 * - It requires to send `all required fields` or the `full body`
 * @public
 * @function
 * @param {string} resourceType - The type of resource to be updated. E.g. `dataElements`, `organisationUnits`, etc.
 * @param {string} path - The `id` or `path` to the `object` to be updated. E.g. `FTRrcoaog83` or `FTRrcoaog83/{collection-name}/{object-id}`
 * @param {Object} data - Data to update. It requires to send `all required fields` or the `full body`. If you want `partial updates`, use `patch` operation.
 * @param {Object} [params] - Optional `update` parameters e.g. `{preheatCache: true, strategy: 'UPDATE', mergeMode: 'REPLACE'}`. Run `discover` or see {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#create-update-parameters DHIS2 documentation}
 * @param {{apiVersion: number,operationName: string,resourceType: string}} [options] - Optional options for update method. Defaults to `{operationName: 'update', apiVersion: state.configuration.apiVersion, responseType: 'json'}`
 * @param {function} [callback]  - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>Example `updating` a `data element`</caption>
 * update('dataElements', 'FTRrcoaog83',
 * {
 *   displayName: 'New display name',
 *   aggregationType: 'SUM',
 *   domainType: 'AGGREGATE',
 *   valueType: 'NUMBER',
 *   name: 'Accute Flaccid Paralysis (Deaths < 5 yrs)',
 *   shortName: 'Accute Flaccid Paral (Deaths < 5 yrs)',
 * });
 *
 */
export function update(resourceType, path, data, params, options, callback) {
  return state => {
    resourceType = expandReferences(resourceType)(state);

    path = expandReferences(path)(state);

    const body = expandReferences(data)(state);

    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const { username, password, hostUrl } = state.configuration;

    const operationName = options?.operationName ?? 'update';

    const responseType = options?.responseType ?? 'json';

    const filters = params?.filters;

    delete params?.filters;

    let queryParams = new URLSearchParams(params);

    filters?.map(f => queryParams.append('filter', f));

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const url = buildUrl('/' + resourceType + '/' + path, hostUrl, apiVersion);

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(resourceType, url);

    return axios
      .request({
        method: 'PUT',
        url,
        auth: {
          username,
          password,
        },
        params: queryParams,
        data: body,
        headers,
      })
      .then(result => {
        Log.info(
          `${operationName} succeeded. Updated ${resourceType}.\nSummary:\n${prettyJson(
            result.data
          )}`
        );
        if (callback) return callback(composeNextState(state, result.data));
        return composeNextState(state, result.data);
      });
  };
}

/**
 * Patch a record. A generic helper function to send partial updates on one or more object properties.
 * - You are not required to send the full body of object properties.
 * - This is useful for cases where you don't want or need to update all properties on a object.
 * @public
 * @function
 * @param {string} resourceType - The type of resource to be updated. E.g. `dataElements`, `organisationUnits`, etc.
 * @param {string} path - The `id` or `path` to the `object` to be updated. E.g. `FTRrcoaog83` or `FTRrcoaog83/{collection-name}/{object-id}`
 * @param {Object} data - Data to update. Include only the fields you want to update. E.g. `{name: "New Name"}`
 * @param {Object} [params] - Optional `update` parameters e.g. `{preheatCache: true, strategy: 'UPDATE', mergeMode: 'REPLACE'}`. Run `discover` or see {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#create-update-parameters DHIS2 documentation}
 * @param {{apiVersion: number,operationName: string,responseType: string}} [options] - Optional options for update method. Defaults to `{operationName: 'patch', apiVersion: state.configuration.apiVersion, responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>Example `patching` a `data element`</caption>
 * patch('dataElements', 'FTRrcoaog83',
 * {
 *   name: 'New Name',
 * });
 */
export function patch(resourceType, path, data, params, options, callback) {
  return state => {
    resourceType = expandReferences(resourceType)(state);

    path = expandReferences(path)(state);

    const body = expandReferences(data)(state);

    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const operationName = options?.operationName ?? 'patch';

    const { username, password, hostUrl } = state.configuration;

    const responseType = options?.responseType ?? 'json';

    let queryParams = params;

    const filters = queryParams?.filters;

    delete queryParams?.filters;

    queryParams = new URLSearchParams(queryParams);

    filters?.map(f => queryParams.append('filter', f));

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const url = buildUrl('/' + resourceType + '/' + path, hostUrl, apiVersion);

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(resourceType, url);

    return axios
      .request({
        method: 'PATCH',
        url,
        auth: {
          username,
          password,
        },
        params: queryParams,
        data: body,
        headers,
      })
      .then(result => {
        let resultObject = {
          status: result.status,
          statusText: result.statusText,
        };
        Log.info(
          `${operationName} succeeded. Updated ${resourceType}.\nSummary:\n${prettyJson(
            resultObject
          )}`
        );
        if (callback) return callback(composeNextState(state, resultObject));
        return composeNextState(state, resultObject);
      });
  };
}

/**
 * Delete a record. A generic helper function to delete an object
 * @public
 * @function
 * @param {string} resourceType - The type of resource to be deleted. E.g. `trackedEntityInstances`, `organisationUnits`, etc.
 * @param {string} path - Can be an `id` of an `object` or `path` to the `nested object` to `delete`.
 * @param {Object} [data] - Optional. This is useful when you want to remove multiple objects from a collection in one request. You can send `data` as, for example, `{"identifiableObjects": [{"id": "IDA"}, {"id": "IDB"}, {"id": "IDC"}]}`. See more {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#deleting-objects on DHIS2 API docs}
 * @param {Object} [params] - Optional `update` parameters e.g. `{preheatCache: true, strategy: 'UPDATE', mergeMode: 'REPLACE'}`. Run `discover` or see {@link https://docs.dhis2.org/2.34/en/dhis2_developer_manual/web-api.html#create-update-parameters DHIS2 documentation}
 * @param {{apiVersion: number,operationName: string,resourceType: string}} [options] - Optional `options` for `del` operation. Defaults to `{operationName: 'delete', apiVersion: state.configuration.apiVersion, responseType: 'json'}`
 * @param {function} [callback] - Optional callback to handle the response
 * @returns {Operation}
 * @example <caption>Example`deleting` a `tracked entity instance`</caption>
 * del('trackedEntityInstances', 'LcRd6Nyaq7T');
 */
export function del(resourceType, path, data, params, options, callback) {
  return state => {
    resourceType = expandReferences(resourceType)(state);

    path = expandReferences(path)(state);

    const body = expandReferences(data)(state);

    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const operationName = options?.operationName ?? 'delete';

    const { username, password, hostUrl } = state.configuration;

    const responseType = options?.responseType ?? 'json';

    let queryParams = params;

    const filters = queryParams?.filters;

    delete queryParams?.filters;

    queryParams = new URLSearchParams(queryParams);

    filters?.map(f => queryParams.append('filter', f));

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    const url = buildUrl('/' + resourceType + '/' + path, hostUrl, apiVersion);

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(resourceType, url);

    return axios
      .request({
        method: 'DELETE',
        url,
        auth: {
          username,
          password,
        },
        params: queryParams,
        data: body,
        headers,
      })
      .then(result => {
        Log.info(
          `${operationName} succeeded. DELETED ${resourceType}.\nSummary:\n${prettyJson(
            result.data
          )}`
        );
        if (callback) return callback(composeNextState(state, result.data));
        return composeNextState(state, result.data);
      });
  };
}

/**
 * Upsert a record. A generic helper function used to atomically either insert a row, or on the basis of the row already existing, UPDATE that existing row instead.
 * @public
 * @function
 * @param {string} resourceType - The type of a resource to `insert` or `update`. E.g. `trackedEntityInstances`
 * @param {{attributeId: string,attributeValue:any}} uniqueAttribute - An object containing a `attributeId` and `attributeValue` which will be used to uniquely identify the record
 * @param {Object} data - The update data containing new values
 * @param {Object} [params] - Optional `import` parameters e.g. `{ou: 'lZGmxYbs97q', filters: ['w75KJ2mc4zz:EQ:Jane']}`
 * @param {{replace:boolean, apiVersion: number,strict: boolean,responseType: string}} [options] - `Optional` options for `upsertTEI` operation. Defaults to `{replace: false, apiVersion: state.configuration.apiVersion,strict: true,responseType: 'json'}`.
 * @param {function} [callback] - Optional callback to handle the response
 * @throws {RangeError} - Throws range error
 * @returns {Operation}
 * @example <caption>- Example `expression.js` of upsert</caption>
 * upsert(
 *    'trackedEntityInstances',
 *    {
 *       attributeId: 'lZGmxYbs97q',
 *          attributeValue: state =>
 *             state.data.attributes.find(obj => obj.attribute === 'lZGmxYbs97q')
 *             .value,
 *    },
 *    state.data,
 *    { ou: 'TSyzvBiovKh' }
 * );
 * @todo Tweak/refine to mimic implementation based on the following inspiration: {@link https://sqlite.org/lang_upsert.html sqlite upsert} and {@link https://wiki.postgresql.org/wiki/UPSERT postgresql upsert}
 * @todo Test implementation for upserting metadata
 * @todo Test implementation for upserting data values
 * @todo Implement the updateCondition
 */
export function upsert(
  resourceType,
  uniqueAttribute,
  data,
  params,
  options,
  callback
) {
  return state => {
    resourceType = expandReferences(resourceType)(state);

    uniqueAttribute = expandReferences(uniqueAttribute)(state);

    const body = expandReferences(data)(state);

    params = expandReferences(params)(state);

    options = expandReferences(options)(state);

    const operationName = options?.operationName ?? 'upsert';

    const { username, password, hostUrl } = state.configuration;

    const replace = options?.replace ?? false;

    const responseType = options?.responseType ?? 'json';

    const { attributeId, attributeValue } = uniqueAttribute;

    const filters = params?.filters;

    delete params.filters;

    let queryParams = new URLSearchParams(params);

    filters?.map(f => queryParams.append('filter', f));

    const op = resourceType === 'trackedEntityInstances' ? 'EQ' : 'eq';

    queryParams.append('filter', `${attributeId}:${op}:${attributeValue}`);

    const apiVersion = options?.apiVersion ?? state.configuration.apiVersion;

    const url = buildUrl('/' + resourceType, hostUrl, apiVersion);

    const headers = {
      Accept: CONTENT_TYPES[responseType] ?? 'application/json',
    };

    logOperation(operationName);

    logApiVersion(apiVersion);

    logWaitingForServer(url, queryParams);

    warnExpectLargeResult(resourceType, url);

    const getResouceName = () => {
      return axios
        .get(hostUrl + '/api/resources', {
          auth: { username, password },
          transformResponse: [
            function (data, headers) {
              let filter = `plural:eq:${resourceType}`;
              if (filter) {
                if (
                  (headers['content-type']?.split(';')[0] ?? null) ===
                  CONTENT_TYPES.json
                ) {
                  let tempData = JSON.parse(data);
                  return {
                    ...tempData,
                    resources: applyFilter(
                      tempData.resources,
                      ...parseFilter(filter)
                    ),
                  };
                } else {
                  Log.warn(
                    'Filters on this resource are only supported for json content types. Skipping filtering ...'
                  );
                }
              }
              return data;
            },
          ],
        })
        .then(result => result.data.resources[0].singular);
    };

    const findRecordsWithValueOnAttribute = () => {
      console.log(queryParams);
      return axios.request({
        method: 'GET',
        url,
        auth: {
          username,
          password,
        },
        params: queryParams,
        headers,
      });
    };

    Log.info(
      `Checking if a record exists that matches this filter: attribute{ id: ${attributeId}, value: ${attributeValue} } ...`
    );
    return Promise.all([
      getResouceName(),
      findRecordsWithValueOnAttribute(),
    ]).then(([resourceName, recordsWithValue]) => {
      const recordsWithValueCount = recordsWithValue.data[resourceType].length;
      if (recordsWithValueCount > 1) {
        Log.error('');
        throw new RangeError(
          `Cannot upsert on Non-unique attribute. The operation found more than one records with the same value of ${attributeValue} for ${attributeId}`
        );
      } else if (recordsWithValueCount === 1) {
        // TODO
        // Log.info(
        //   `Unique record found, proceeding to checking if attribute is NULLABLE ...`
        // );
        // if (recordsWithNulls.data[resourceType].length > 0) {
        //   throw new Error(
        //     `Cannot upsert on Nullable attribute. The operation found records with a NULL value on ${attributeId}.`
        //   );
        // }
        Log.info(
          `Attribute has unique values. Proceeding to ${
            replace ? 'replace' : 'merge'
          } ...`
        );

        const row1 = recordsWithValue.data[resourceType][0];
        const useCustomPATCH = ['trackedEntityInstances'].includes(resourceType)
          ? true
          : false;
        const method = replace
          ? 'PUT'
          : useCustomPATCH === true
          ? 'PUT'
          : 'PATCH';

        const id = row1['id'] ?? row1[resourceName];

        const updateUrl = `${url}/${id}`;

        const payload = useCustomPATCH
          ? {
              ...row1,
              ...body,
              attributes: [...row1.attributes, ...body.attributes],
            }
          : body;

        return axios
          .request({
            method,
            url: updateUrl,
            auth: {
              username,
              password,
            },
            data: payload,
            params: queryParams,
            headers,
          })
          .then(result => {
            Log.info(
              `${operationName} succeeded. Updated ${resourceName}: ${updateUrl}.\nSummary:\n${prettyJson(
                result.data
              )}`
            );
            if (callback) return callback(composeNextState(state, result.data));
            return composeNextState(state, result.data);
          });
      } else if (recordsWithValueCount === 0) {
        Log.info(`Existing record not found, proceeding to CREATE(POST) ...`);

        // We must delete the filter and ou params so the POST request is not interpreted as a GET request by the server
        queryParams.delete('filter');
        queryParams.delete('ou');

        return axios
          .request({
            method: 'POST',
            url,
            auth: {
              username,
              password,
            },
            data: body,
            params: queryParams,
            headers,
          })
          .then(result => {
            Log.info(
              `${operationName} succeeded. Created ${resourceName}: ${
                result.data.response.importSummaries
                  ? result.data.response.importSummaries[0].href
                  : result.data.response?.reference
              }.\nSummary:\n${prettyJson(result.data)}`
            );
            if (callback) return callback(composeNextState(state, result.data));
            return composeNextState(state, result.data);
          });
      }
    });
  };
}

export { attribute } from './Utils';

export {
  field,
  fields,
  sourceValue,
  merge,
  each,
  dataPath,
  dataValue,
  lastReferenceValue,
  alterState,
  http,
} from '@openfn/language-common';
