import * as core from "../core";
import { Status_DB } from "./status_db_interface";
import { Db, Collection } from "mongodb";
import { Entity } from "../core";

export class Status_DB_Mongo implements Status_DB {
    collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("entity");
    }

    async init(): Promise<void> {
        await this.collection.createIndex(
            {"metadata.uuid": 1},
            {name: "entity_uuid", unique: true}
        );
    }

    async update_status(entity_ref: core.Entity_Reference, status: core.Status): Promise<void> {
        const result = await this.collection.updateOne({
            "metadata.uuid": entity_ref.uuid,
            "metadata.kind": entity_ref.kind
        }, {
            $set: {
                "status": status
            },
            $setOnInsert: {
                "created_at": new Date()
            }
        }, {
            upsert: true
        });
        if (result.result.n !== 1) {
            throw new Error(`Amount of updated entries doesn't equal to 1: ${result.result.n}`)
        }
    }

    async get_status(entity_ref: core.Entity_Reference): Promise<[core.Metadata, core.Status]> {
        const result: Entity | null = await this.collection.findOne({
            "metadata.uuid": entity_ref.uuid,
            "metadata.kind": entity_ref.kind
        });
        if (result === null) {
            throw new Error("Not found")
        }
        return [result.metadata, result.status]
    }

    async list_status(fields_map: any): Promise<([core.Metadata, core.Status])[]> {
        const result = await this.collection.find(fields_map).toArray();
        return result.map((x: any): [core.Metadata, core.Status] => {
            if (x.status !== null) {
                return [x.metadata, x.status]
            } else {
                throw new Error("No entities found")
            }
        });
    }

    async delete_status(entity_ref: core.Entity_Reference): Promise<void> {
        const result = await this.collection.updateOne({
            "metadata.uuid": entity_ref.uuid,
            "metadata.kind": entity_ref.kind
        }, {
            $set: {
                "deletedAt": new Date()
            }
        });
        if (result.result.n === undefined || result.result.ok !== 1) {
            throw new Error("Failed to remove status");
        }
        if (result.result.n !== 1 && result.result.n !== 0) {
            throw new Error("Amount of entities must be 0 or 1");
        }
        return;
    }
}