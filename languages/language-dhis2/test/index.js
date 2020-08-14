import { expect } from 'chai';

import Adaptor from '../src';
const { execute, event, dataElement, fetchData, fetchEvents} = Adaptor;

import request from 'superagent';
import superagentMock from 'superagent-mock';
import ClientFixtures, { fixtures } from './ClientFixtures'

describe("execute", () => {

  it("executes each operation in sequence", (done) => {
    let state = {}
    let operations = [
      (state) => { return {counter: 1} },
      (state) => { return {counter: 2} },
      (state) => { return {counter: 3} }
    ]

    execute(...operations)(state)
    .then((finalState) => {
      expect(finalState).to.eql({ counter: 3 })
    })
    .then(done).catch(done)


  })

  it("assigns references, data to the initialState", () => {
    let state = {}

    let finalState = execute()(state)

    execute()(state)
    .then((finalState) => {
      expect(finalState).to.eql({
        references: [],
        data: null
      })
    })

  })
})

describe("event", () => {
  let mockRequest

  before(() => {
    mockRequest = superagentMock(request, ClientFixtures)
  })

  it("posts to API and returns state", () => {
    let state = {
      configuration: {
        username: "hello",
        password: "there",
        hostUrl: 'https://play.dhis2.org/demo'
      }
    };

    return execute(
      event(fixtures.event.requestBody)
    )(state)
    .then((state) => {
      let lastReference = state.references[0]

      // Check that the eventData made it's way to the request as a string.
      expect(lastReference.params).
        to.eql(JSON.stringify(fixtures.event.requestBody))

    })

  })

  after(() => {
    mockRequest.unset()
  })

})

describe("dataElement", function() {
  it("creates a dataElement from key, value, comment args", function() {
    let element = dataElement("key", "foo")
    expect(element).to.eql({ dataElement: "key", value: "foo", comment: undefined })

    let commentedElement = dataElement("key", "foo", "bar")
    expect(commentedElement).to.eql({ dataElement: "key", value: "foo", comment: "bar" })
  })
})

describe("fetchData", function() {

  it("fetches data set values", function() {
    let state = {
      configuration: {
        username: "admin",
        password: "district",
        hostUrl: 'https://play.dhis2.org/demo'
      }
    };

    let params = {
      fields: {
        dataSet: 'pBOMPrpg1QX',
        orgUnit: 'DiszpKrYNg8',
        period: '201401'
      }
    }

    return execute(fetchData(params))(state)
    .then((state) => {
      let lastReference = state.references[0]
      expect(lastReference.statusCode).to.eql(200)

    })

  }).timeout(10000)
});

describe("fetchEvents", function() {

  it("fetches events", function() {
    let state = {
      configuration: {
        username: "admin",
        password: "district",
        hostUrl: 'https://play.dhis2.org/demo'
      }
    };

    let params = {
        fields: {
          orgUnit: 'DiszpKrYNg8',
          program: 'eBAyeGv0exc',
          endDate: '2016-01-01'
        }
    }

    return execute(fetchEvents(params))(state)
    .then((state) => {
      let lastReference = state.references[0]
      expect(lastReference.statusCode).to.eql(200)

    })

  }).timeout(10000)
});
