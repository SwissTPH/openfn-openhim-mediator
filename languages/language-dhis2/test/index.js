import { expect } from 'chai';
import { dataValue } from '@openfn/language-common';
import {
  execute,
  getData,
  upsert,
  upsertTEI,
  create,
  attribute,
  update,
  patch,
  del,
  getMetadata,
  getSchema,
  getResources,
  getAnalytics,
  discover,
  generateDhis2UID,
  getDataValues,
  createEvents,
  enrollTEI,
} from '../lib/Adaptor';
import nock from 'nock';
import {
  upsertNewState,
  upsertExistingState,
  upsertExistingTEIState,
  upsertNewTEIState,
  createState,
  updateState,
  patchState,
  delState,
  getState,
  createBulkUnrelatedDataValues,
  createRelatedDataValues,
  createEventsState,
  sendDataForMultipleEventsState,
  enrollTEIState,
  demoVersion,
} from './ClientFixtures';
import { permissions, userRoles, personAttributes } from './SetupFixtures';
import { result } from 'lodash';
import { prettyJson } from '../src/Utils';
import { createDataValues } from '../src/Adaptor';

describe('execute', () => {
  it('executes each operation in sequence', done => {
    let state = {
      configuration: {
        hostUrl: 'https://play.dhis2.org/demo',
      },
    };
    let operations = [
      state => {
        return { counter: 1 };
      },
      state => {
        return { counter: 2 };
      },
      state => {
        return { counter: 3 };
      },
    ];

    execute(...operations)(state)
      .then(finalState => {
        expect(finalState).to.eql({ counter: 3 });
      })
      .then(done)
      .catch(done);
  });

  it('assigns references, data to the initialState', () => {
    let state = {
      configuration: {
        hostUrl: 'https://play.dhis2.org/demo',
      },
    };

    let finalState = execute()(state);

    execute()(state).then(finalState => {
      expect(finalState).to.eql({
        configuration: {
          hostUrl: 'https://play.dhis2.org/demo',
        },
        references: [],
        data: null,
      });
    });
  });
});

describe('live adaptor testing', () => {
  console.log(demoVersion);
  // before ALL tests run, we must re-configure the dhis2 environment
  before(function () {
    this.timeout(30000);
    let state = {
      configuration: {
        username: 'admin',
        password: 'district',
        hostUrl: `https://play.dhis2.org/${demoVersion}`,
      },
    };

    return execute(update('users', 'xE7jOejl9FI', permissions))(state)
      .then(() => {
        console.log('updated user permissions');
      })
      .then(() => {
        console.log('updated user roles');
        return execute(update('users', 'xE7jOejl9FI', userRoles))(state);
      })
      .then(() => {
        console.log('assigned attributes to person entity type');
        return execute(
          update('trackedEntityTypes', 'nEenWmSyUEp', personAttributes, {
            mergeMode: 'REPLACE',
          })
        )(state);
      })
      .then(() => {
        // PUT add Programs... // ??
        // console.log('updated programs');
        console.log('dhis2 instance configured, starting tests...');
      });
  });

  describe('buildUrl for getData', () => {
    before(() => {
      nock('https://play.dhis2.org/2.35.0/')
        .get(uri => uri.includes('api/34'))
        .reply(200, {
          trackedEntityInstances: ['from v34'],
        });

      nock('https://play.dhis2.org/2.35.0/')
        .get(uri => uri.includes('api/999'))
        .reply(200, {
          trackedEntityInstances: ['from v999'],
        });
    });

    it('should respect api version when passed through configuration', () => {
      let state = {
        configuration: {
          username: 'admin',
          password: 'district',
          hostUrl: `https://play.dhis2.org/${demoVersion}`,
          apiVersion: 34,
        },
      };

      return execute(getData('trackedEntityInstances', {}))(state).then(
        state => {
          expect(state.data.trackedEntityInstances[0]).to.eq('from v34');
        }
      );
    }).timeout(10 * 1000);

    it('should respect the api version when passed through the options argument', () => {
      let state = {
        configuration: {
          username: 'admin',
          password: 'district',
          hostUrl: `https://play.dhis2.org/${demoVersion}`,
        },
      };

      return execute(
        getData('trackedEntityInstances', {}, { apiVersion: 999 })
      )(state).then(state => {
        expect(state.data.trackedEntityInstances[0]).to.eq('from v999');
      });
    }).timeout(10 * 1000);
  });

  describe('getData', () => {
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it("should return one trackedEntityInstance with trackedInstanceInstance Id 'dNpxRu1mWG5' for a given orgUnit(DiszpKrYNg8)", () => {
      let state = {
        configuration: {
          username: 'admin',
          password: 'district',
          hostUrl: `https://play.dhis2.org/${demoVersion}`,
        },
      };

      return execute(
        getData('trackedEntityInstances', {
          fields: '*',
          ou: 'DiszpKrYNg8',
          entityType: 'nEenWmSyUEp',
          trackedEntityInstance: 'dNpxRu1mWG5',
        })
      )(state).then(state => {
        const instances = state.data.trackedEntityInstances;
        expect(instances.length).to.eq(1);
        expect(instances[0].trackedEntityInstance).to.eq('dNpxRu1mWG5');
      });
    }).timeout(10 * 1000);
  });

  describe('upsert', () => {
    let state = upsertExistingState;
    state.attributeVal = state =>
      state.data.attributes.find(obj => obj.attribute === 'lZGmxYbs97q').value;
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should create a new TEI', () => {
      return execute(
        upsert(
          'trackedEntityInstances',
          {
            attributeId: 'lZGmxYbs97q',
            attributeValue: state =>
              state.data.attributes.find(obj => obj.attribute === 'lZGmxYbs97q')
                .value,
          },
          state.data,
          { ou: 'TSyzvBiovKh' }
        )
      )(state).then(result => {
        expect(result.data.httpStatus).to.eq('OK');
        expect(result.data.httpStatusCode).to.eq(200);
        expect(result.data.response.imported).to.eq(1);
        expect(result.data.response.updated).to.eq(0);
        expect(result.data.response.deleted).to.eq(0);
        expect(result.data.response.ignored).to.eq(0);
      });
    }).timeout(20 * 1000);

    it('should update an existing TEI when a matching TEI is found by attribute ID', () => {
      return execute(
        upsert(
          'trackedEntityInstances',
          {
            attributeId: 'lZGmxYbs97q',
            attributeValue: state.attributeVal,
          },
          state.data,
          { ou: 'TSyzvBiovKh' }
        )
      )(state).then(state => {
        expect(state.data.response.importCount.imported).to.eq(0);
        expect(state.data.response.importCount.updated).to.eq(1);
        expect(state.data.response.importCount.deleted).to.eq(0);
        expect(state.data.response.importCount.ignored).to.eq(0);
        expect(state.data.response.importCount.ignored).to.eq(0);
      });
    }).timeout(30 * 1000);

    it('should create a new TEI when a matching TEI is not found by attribute ID', () => {
      let state = upsertNewState;

      return execute(
        upsert(
          'trackedEntityInstances',
          {
            attributeId: 'lZGmxYbs97q',
            attributeValue: state =>
              state.data.attributes.find(obj => obj.attribute === 'lZGmxYbs97q')
                .value,
          },
          state.data,
          { ou: 'TSyzvBiovKh' }
        )
      )(state).then(state => {
        expect(state.data.response.imported).to.eq(1);
        expect(state.data.response.updated).to.eq(0);
        expect(state.data.response.deleted).to.eq(0);
        expect(state.data.response.ignored).to.eq(0);
      });
    }).timeout(20 * 1000);
  });

  describe('upsertTEI', () => {
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should update an existing TEI when a matching TEI is found by attribute ID', () => {
      let state = upsertExistingTEIState;

      return execute(upsertTEI('lZGmxYbs97q', state.data))(state).then(
        state => {
          expect(state.data.response.importCount.imported).to.eq(0);
          expect(state.data.response.importCount.updated).to.eq(1);
          expect(state.data.response.importCount.deleted).to.eq(0);
          expect(state.data.response.importCount.ignored).to.eq(0);
        }
      );
    }).timeout(20 * 1000);

    it('should create a new TEI when a matching TEI is not found by attribute ID', () => {
      let state = upsertNewTEIState;

      return execute(upsertTEI('lZGmxYbs97q', state.data))(state).then(
        state => {
          expect(state.data.response.imported).to.eq(1);
          expect(state.data.response.updated).to.eq(0);
          expect(state.data.response.deleted).to.eq(0);
          expect(state.data.response.ignored).to.eq(0);
        }
      );
    }).timeout(20 * 1000);

    it('should allow the user to build a TEI object from a generic state', () => {
      let state = {
        ...upsertNewTEIState,
        data: {
          form: {
            name: 'Taylor',
            uniqueId: '1135353',
            organization: 'TSyzvBiovKh',
            programsJoined: ['fDd25txQckK'],
          },
        },
      };

      return execute(
        upsertTEI('lZGmxYbs97q', {
          orgUnit: state.data.form.organization,
          trackedEntityType: 'nEenWmSyUEp',
          attributes: [
            {
              attribute: 'w75KJ2mc4zz',
              value: state.data.form.name,
            },
            {
              attribute: 'lZGmxYbs97q',
              value: state.data.form.uniqueId,
            },
          ],
          enrollments: state =>
            state.data.form.programsJoined.map(item => ({
              orgUnit: state.data.form.organization,
              program: item,
              programState: 'lST1OZ5BDJ2',
              enrollmentDate: '2021-01-05',
              incidentDate: '2021-01-05',
            })),
        })
      )(state).then(state => {
        expect(state.data.response.status).to.eq('SUCCESS');
        expect(state.data.httpStatusCode).to.eq(200);
        expect(
          state.data.response.deleted ?? state.data.response.importCount.deleted
        ).to.eq(0);
        expect(
          state.data.response.ignored ?? state.data.response.importCount.ignored
        ).to.eq(0);
      });
    }).timeout(20 * 1000);

    it('should allow the user to use `attribute` and `dataValue` helper functions', () => {
      let state = {
        ...upsertNewTEIState,
        data: {
          form: {
            name: 'Taylor',
            uniqueId: '1135354',
            organization: 'TSyzvBiovKh',
            programsJoined: ['fDd25txQckK'],
          },
        },
      };

      return execute(
        upsertTEI('lZGmxYbs97q', {
          orgUnit: dataValue('form.organization'),
          trackedEntityType: 'nEenWmSyUEp',
          attributes: [
            attribute('w75KJ2mc4zz', dataValue('form.name')),
            attribute('lZGmxYbs97q', dataValue('form.uniqueId')),
          ],
          enrollments: state =>
            state.data.form.programsJoined.map(item => ({
              orgUnit: dataValue('form.organization'),
              program: item,
              programState: 'lST1OZ5BDJ2',
              enrollmentDate: '2021-01-05',
              incidentDate: '2021-01-05',
            })),
        })
      )(state).then(state => {
        expect(state.data.response.status).to.eq('SUCCESS');
        expect(state.data.httpStatusCode).to.eq(200);
        expect(
          state.data.response.deleted ?? state.data.response.importCount.deleted
        ).to.eq(0);
        expect(
          state.data.response.ignored ?? state.data.response.importCount.ignored
        ).to.eq(0);
      });
    }).timeout(20 * 1000);

    it('should allow the user to use `arrow function` to access data', () => {
      let state = {
        ...upsertNewTEIState,
        data: {
          form: {
            name: 'Taylor',
            uniqueId: '1135354',
            organization: 'TSyzvBiovKh',
            programsJoined: ['fDd25txQckK'],
          },
        },
      };

      return execute(
        upsertTEI('lZGmxYbs97q', {
          orgUnit: state => state.data.form.organization,
          trackedEntityType: 'nEenWmSyUEp',
          attributes: [
            attribute('w75KJ2mc4zz', state => state.data.form.name),
            attribute('lZGmxYbs97q', state => state.data.form.uniqueId),
          ],
          enrollments: state =>
            state.data.form.programsJoined.map(item => ({
              orgUnit: state.data.form.organization,
              program: item,
              programState: 'lST1OZ5BDJ2',
              enrollmentDate: '2021-01-05',
              incidentDate: '2021-01-05',
            })),
        })
      )(state).then(state => {
        expect(state.data.response.status).to.eq('SUCCESS');
        expect(state.data.httpStatusCode).to.eq(200);
        expect(
          state.data.response.deleted ?? state.data.response.importCount.deleted
        ).to.eq(0);
        expect(
          state.data.response.ignored ?? state.data.response.importCount.ignored
        ).to.eq(0);
      });
    }).timeout(20 * 1000);
  });

  describe('create', () => {
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it.skip(
      'should create a new single event and link it to a given program',
      () => {
        let state = createState;
        return execute(create('events', state.data))(state).then(state => {
          expect(state.data.response.imported).to.eq(1);
          expect(state.data.response.updated).to.eq(0);
          expect(state.data.response.deleted).to.eq(0);
          expect(state.data.response.ignored).to.eq(0);
        });
      }
    ).timeout(20 * 1000);
  });

  describe('update', () => {
    let state = updateState;
    state.data.name += Date.now();
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should update the name of a data element', () => {
      return execute(update('dataElements', state.data.id, state.data))(
        state
      ).then(result => {
        expect(result.data.httpStatusCode).to.eq(200);
        expect(result.data.response.uid).to.eq(state.data.id);
      });
    }).timeout(20 * 1000);

    it('should verify that the name of the data element was updated', () => {
      return execute(getData(`dataElements/${state.data.id}`))(state).then(
        result => {
          expect(result.data.name).to.eq(state.data.name);
        }
      );
    }).timeout(20 * 1000);
  });

  describe('patch', () => {
    let state = patchState;
    state.id = 'FTRrcoaog83';
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should do a partial update(patch) of a data element', () => {
      return execute(patch('dataElements', state.id, state.data))(state).then(
        result => {
          expect(result.data.status).to.eq(204);
        }
      );
    }).timeout(20 * 1000);

    it('should verify that the name of the data element was updated', () => {
      return execute(getData(`dataElements/${state.id}`))(state).then(
        result => {
          expect(result.data.name).to.eq(state.data.name);
        }
      );
    }).timeout(20 * 1000);
  });

  describe('delete', () => {
    let id = '';
    let state = delState;
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should create a new tracked entity instance', () => {
      return execute(create('trackedEntityInstances', state.data))(state).then(
        result => {
          id = result.data.response.importSummaries[0].reference;
          expect(result.data.response.imported).to.eq(1);
          expect(result.data.response.updated).to.eq(0);
          expect(result.data.response.deleted).to.eq(0);
          expect(result.data.response.ignored).to.eq(0);
        }
      );
    }).timeout(20 * 1000);

    it('should delete the newly created tracked entity instance', () => {
      return execute(del('trackedEntityInstances', id))(state).then(result => {
        expect(result.data.response.importCount.imported).to.eq(0);
        expect(result.data.response.importCount.updated).to.eq(0);
        expect(result.data.response.importCount.ignored).to.eq(0);
        expect(result.data.response.importCount.deleted).to.eq(1);
      });
    }).timeout(20 * 1000);
  });

  describe('getMetadata', () => {
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should get a list of orgUnits', () => {
      let state = getState;
      return execute(
        getMetadata('organisationUnits', { fields: ['id', 'name'] })
      )(state).then(result => {
        expect(result.data.organisationUnits.length).to.be.gte(1);
      });
    }).timeout(30 * 1000);

    it('should get data elements and indicators where name includes "ANC"', () => {
      let state = getState;
      return execute(
        getMetadata(['dataElements', 'indicators'], {
          filters: ['name:like:ANC'],
          fields: ['id', 'name'],
        })
      )(state).then(result => {
        expect(result.data.dataElements.length).to.be.gte(1);
        expect(result.data.indicators.length).to.be.gte(1);
      });
    }).timeout(20 * 1000);
  });

  describe('getSchema', () => {
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should get the schema for dataElement', () => {
      let state = getState;
      return execute(getSchema('dataElement'))(state).then(result => {
        expect(result.data.name).to.eq('dataElement');
      });
    }).timeout(20 * 1000);

    it('should get the schema for dataElement, only returning the `properties` field', () => {
      let state = getState;
      return execute(getSchema('dataElement', { fields: 'properties' }))(
        state
      ).then(result => {
        expect(result.data).to.have.a.key('properties');
        expect(Object.keys(result.data).length).to.eq(1);
      });
    }).timeout(20 * 1000);

    it('should get the schema for dataElement in XML, returning all the fields', () => {
      let state = getState;
      return execute(
        getSchema('dataElement', { fields: '*' }, { responseType: 'xml' })
      )(state).then(result => {
        expect(result.data.slice(2, 5)).to.eq('xml');
      });
    }).timeout(20 * 1000);
  });

  describe('getResources', () => {
    let state = getState;
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should get a list of all DHIS2 resources', () => {
      return execute(getResources())(state).then(result => {
        expect(result.data.resources.length).to.be.gte(1);
      });
    }).timeout(20 * 1000);

    it('should get a resource named `attribute`, in `json` format', () => {
      return execute(getResources({ filter: 'singular:eq:attribute' }))(
        state
      ).then(result => {
        expect(result.data.resources.length).to.be.eq(1);
        expect(result.data.resources[0].singular).to.be.eq('attribute');
      });
    }).timeout(20 * 1000);

    it('should get a resource named `attribute`, in `xml` format, returning all the fields', () => {
      return execute(
        getResources('dataElement', {
          filter: 'singular:eq:attribute',
          fields: '*',
          responseType: 'xml',
        })
      )(state).then(result => {
        expect(result.data.slice(2, 5)).to.be.eq('xml');
      });
    }).timeout(20 * 1000);
  });

  describe('getAnalytics', () => {
    let state = getState;
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should return a list of data elements filtered by the periods and organisation units', () => {
      return execute(
        getAnalytics({
          dimensions: ['dx:fbfJHSPpUQD;cYeuwXTCPkU'],
          filters: ['pe:2014Q1;2014Q2', 'ou:O6uvpzGd5pu;lc3eMKXaEfw'],
        })
      )(state).then(result => {
        expect(result.data).to.be.not.null;
        expect(result.data).to.haveOwnProperty('rows');
      });
    }).timeout(20 * 1000);

    it('should return only records where the data value is greater or equal to 6500 and less than 33000', () => {
      return execute(
        getAnalytics({
          dimensions: [
            'dx:fbfJHSPpUQD;cYeuwXTCPkU',
            'pe:2014',
            'ou:O6uvpzGd5pu;lc3eMKXaEfw',
          ],
          measureCriteria: 'GE:6500;LT:33000',
        })
      )(state).then(result => {
        expect(result.data).to.be.not.null;
        expect(result.data).to.haveOwnProperty('rows');
      });
    }).timeout(20 * 1000);

    it('should allow users to send a date range using startDate and endDate', () => {
      return execute(
        getAnalytics({
          dimensions: ['dx:fbfJHSPpUQD;cYeuwXTCPkU', 'ou:ImspTQPwCqd'],
          startDate: '2018-01-01',
          endDate: '2018-06-01',
        })
      )(state).then(result => {
        expect(result.data).to.be.not.null;
        expect(result.data).to.haveOwnProperty('rows');
      });
    }).timeout(20 * 1000);
  });

  describe('discover', () => {
    let state = getState;
    it('should return a list of parameters allowed on a given endpoint for specific http method', () => {
      return execute(discover('get', '/trackedEntityInstances'))(state).then(
        result => {
          expect(result.data.description).to.be.eq(
            'list tracked entity instances (TEIs)'
          );
        }
      );
    }).timeout(30 * 1000);
  });

  describe('generateDhis2UID', () => {
    let state = getState;
    it('should return one UID generated from DHIS2 server', () => {
      return execute(generateDhis2UID())(state).then(result => {
        expect(result.data.codes.length).to.be.eq(1);
      });
    }).timeout(20 * 1000);

    it('should return three UIDs generated from DHIS2 server', () => {
      return execute(generateDhis2UID({ limit: 3 }))(state).then(result => {
        expect(result.data.codes.length).to.be.eq(3);
      });
    }).timeout(20 * 1000);
  });

  describe('getDataValues', () => {
    let state = getState;
    it('should return two `data values` associated with a specific `orgUnit`, `dataSet`, and `period `', () => {
      return execute(
        getDataValues({
          orgUnit: 'DiszpKrYNg8',
          period: '202010',
          dataSet: 'pBOMPrpg1QX',
          limit: 2,
        })
      )(state).then(result => {
        expect(result.data.orgUnit).to.be.eq('DiszpKrYNg8');
        expect(result.data.period).to.be.eq('202010');
        expect(result.data.dataSet).to.be.eq('pBOMPrpg1QX');
        expect(result.data.dataValues.length).to.be.eq(2);
      });
    }).timeout(20 * 1000);
  });

  describe('createDataValues', () => {
    it('should create large bulks of data values which are not logically related', () => {
      let state = createBulkUnrelatedDataValues;
      return execute(createDataValues(state.data))(state).then(result => {
        expect(
          (result.data.status === 'WARNING' &&
            result.data.importCount.ignored > 0) ||
            result.data.importCount.imported > 0 ||
            result.data.importCount.updated > 0
        );
        expect(result.data.importCount.deleted).to.eq(0);
      });
    }).timeout(20 * 1000);

    it('should create large bulks of data values which are not logically related', () => {
      let state = createRelatedDataValues;
      return execute(createDataValues(state.data))(state).then(result => {
        expect(
          (result.data.status === 'WARNING' &&
            result.data.importCount.ignored > 0) ||
            result.data.importCount.imported > 0 ||
            result.data.importCount.updated > 0
        );
        expect(result.data.importCount.deleted).to.eq(0);
      });
    }).timeout(20 * 1000);
  });

  describe('createEvents', () => {
    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it.skip(
      'should create a new single event and link it to a given program',
      () => {
        let state = createEventsState;
        return execute(createEvents(state.data))(state).then(result => {
          expect(result.data.response.imported).to.eq(1);
          expect(result.data.response.updated).to.eq(0);
          expect(result.data.response.deleted).to.eq(0);
          expect(result.data.response.ignored).to.eq(0);
        });
      }
    ).timeout(20 * 1000);

    it.skip(
      'should create two new events and link them to respective programs',
      () => {
        let state = sendDataForMultipleEventsState;
        return execute(createEvents(state.data))(state).then(result => {
          expect(result.data.response.imported).to.eq(2);
          expect(result.data.response.updated).to.eq(0);
          expect(result.data.response.deleted).to.eq(0);
          expect(result.data.response.ignored).to.eq(0);
        });
      }
    ).timeout(20 * 1000);
  });

  describe('enrollTEI', () => {
    let trackedEntityInstance = '';

    let state = enrollTEIState;

    before(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    it('should create a new tracked entity instance', () => {
      return execute(create('trackedEntityInstances', state.data))(state).then(
        result => {
          trackedEntityInstance =
            result.data.response.importSummaries[0].reference;
          expect(result.data.response.imported).to.eq(1);
          expect(result.data.response.updated).to.eq(0);
          expect(result.data.response.deleted).to.eq(0);
          expect(result.data.response.ignored).to.eq(0);
        }
      );
    }).timeout(20 * 1000);

    it('should enroll TEI into a given program', () => {
      let date = new Date();
      state = {
        ...state,
        data: {
          trackedEntityInstance: trackedEntityInstance,
          orgUnit: 'ImspTQPwCqd',
          program: 'WSGAb5XwJ3Y',
          enrollmentDate: date,
          incidentDate: date,
        },
      };

      console.log('state', state);
      return execute(enrollTEI(state.data))(state).then(result => {
        expect(result.data.response.imported).to.eq(1);
        expect(result.data.response.updated).to.eq(0);
        expect(result.data.response.deleted).to.eq(0);
        expect(result.data.response.ignored).to.eq(0);
      });
    }).timeout(20 * 1000);
  });
});
