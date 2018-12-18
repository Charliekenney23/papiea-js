import "jest"

import {MongoConnection} from "../src/databases/mongo";
import {Spec_DB} from "../src/databases/spec_db_interface";
import * as core from "../src/core";
import { v4 as uuid4 } from 'uuid';

declare var process : {
    env: {
        MONGO_URL: string,
        MONGO_DB: string
    }
}

describe("MongoDb tests", () => {
    const connection:MongoConnection = new MongoConnection(process.env.MONGO_URL, process.env.MONGO_DB);
    test("Verify Mongo connection open", done => {
        connection.connect((err) => {
            if (err)
                done.fail(err);
            else
                done();
        });
    });
    let specDb:Spec_DB|undefined;
    test("Get Spec_DB", done => {
        connection.get_spec_db((err, newSpecDb) => {
            if (err)
                done.fail(err);
            else {
                specDb = newSpecDb;
                done();
            }
        });
    });
    let entityA_uuid = uuid4();
    test("Insert Spec", done => {
        if (specDb === undefined) {
            done.fail(new Error("specDb is undefined"));
            return;
        }
        let entity_metadata:core.Metadata = {uuid: entityA_uuid, kind: "test", spec_version: 0, created_at: new Date(), delete_at: null};
        let spec:core.Spec = {a: "A"};
        specDb.update_spec(entity_metadata, spec, (res, entity_metadata, spec) => {
            expect(res).toEqual(true);
            done();
        });
    });
    test("Update Spec", done => {
        if (specDb === undefined) {
            done.fail(new Error("specDb is undefined"));
            return;
        }
        let entity_metadata:core.Metadata = {uuid: entityA_uuid, kind: "test", spec_version: 1, created_at: new Date(), delete_at: null};
        let spec:core.Spec = {a: "A1"};
        specDb.update_spec(entity_metadata, spec, (res, entity_metadata, spec) => {
            expect(res).toEqual(true);
            done();
        });
    });
    test("Update Spec with same version should fail", done => {
        if (specDb === undefined) {
            done.fail(new Error("specDb is undefined"));
            return;
        }
        let entity_metadata:core.Metadata = {uuid: entityA_uuid, kind: "test", spec_version: 1, created_at: new Date(), delete_at: null};
        let spec:core.Spec = {a: "A2"};
        specDb.update_spec(entity_metadata, spec, (res, entity_metadata, spec) => {
            expect(res).toEqual(false);
            done();
        });
    });
    test("Get Spec", done => {
        if (specDb === undefined) {
            done.fail(new Error("specDb is undefined"));
            return;
        }
        let entity_ref:core.Entity_Reference = {uuid: entityA_uuid, kind: "test"};
        specDb.get_spec(entity_ref, (err, entity_metadata, spec) => {
            expect(err).toBeNull();
            if (entity_metadata === undefined || spec === undefined) {
                done.fail(new Error("no data returned"));
                return;
            }
            expect(entity_metadata.uuid).toEqual(entity_ref.uuid);
            expect(spec.a).toEqual("A1");
            done();
        });
    });
    test("Get Spec for non existing entity should fail", done => {
        if (specDb === undefined) {
            done.fail(new Error("specDb is undefined"));
            return;
        }
        let entity_ref:core.Entity_Reference = {uuid: uuid4(), kind: "test"};
        specDb.get_spec(entity_ref, (err, entity_metadata, spec) => {
            expect(err).not.toBeNull();
            done();
        });
    });
    test("List Specs", done => {
        if (specDb === undefined) {
            done.fail(new Error("specDb is undefined"));
            return;
        }
        specDb.list_specs({"metadata.kind": "test"}, (err, res) => {
            expect(err).toBeNull();
            expect(res).not.toBeNull();
            if (res === undefined) {
                done.fail(new Error("no data returned"));
                return;
            }
            expect(res.length).toBeGreaterThanOrEqual(1);
            done();
        });
    });
    test("Verify Mongo connection close", done => {
        connection.close((err) => {
            if (err)
                done.fail(err);
            else
                done();
        });
    });
})
