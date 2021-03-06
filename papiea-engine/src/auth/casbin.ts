import { UserAuthInfo } from "./authn";
import { Authorizer, ProviderAuthorizerFactory } from "./authz";
import { newEnforcer, newModel } from "casbin/lib/casbin";
import { Adapter } from "casbin/lib/persist/adapter";
import { Model } from "casbin/lib/model";
import { Helper } from "casbin/lib/persist/helper";
import { Provider, Action } from "papiea-core";
import { PermissionDeniedError } from "../errors/permission_error";
import { Logger } from "../logger_interface"


export class CasbinAuthorizer extends Authorizer {
    private modelText: string;
    private policyText: string;
    private enforcer: any;
    private logger: Logger

    constructor(logger: Logger, modelText: string, policyText: string) {
        super();
        this.modelText = modelText;
        this.policyText = policyText;
        this.logger = logger;
    }

    async init() {
        const model: Model = newModel(this.modelText);
        const policyAdapter: Adapter = new CasbinMemoryAdapter(this.policyText);
        this.enforcer = await newEnforcer(model, policyAdapter);
    }

    async checkPermission(user: UserAuthInfo, object: any, action: Action): Promise<void> {
        try {
            if (!this.enforcer.enforce(user, object, action)) {
                throw new PermissionDeniedError();
            }
        } catch (e) {
            this.logger.error("CasbinAuthorizer checkPermission error", e);
            throw new PermissionDeniedError();
        }
    }
}

class CasbinMemoryAdapter implements Adapter {
    public readonly policy: string;

    constructor(policy: string) {
        this.policy = policy;
    }

    async loadPolicy(model: Model): Promise<void> {
        if (!this.policy) {
            throw new PermissionDeniedError();
        }
        await this.loadPolicyFile(model, Helper.loadPolicyLine);
    }

    private async loadPolicyFile(model: any, handler: (line: string, model: Model) => void): Promise<void> {
        const lines = this.policy.split('\n');
        lines.forEach((n: string, index: number) => {
            const line = n.trim();
            if (!line) {
                return;
            }
            handler(n, model);
        });
    }

    savePolicy(model: Model): Promise<boolean> {
        throw new Error('not implemented');
    }

    addPolicy(sec: string, ptype: string, rule: string[]): Promise<void> {
        throw new Error('not implemented');
    }

    removePolicy(sec: string, ptype: string, rule: string[]): Promise<void> {
        throw new Error('not implemented');
    }

    removeFilteredPolicy(sec: string, ptype: string, fieldIndex: number, ...fieldValues: string[]): Promise<void> {
        throw new Error('not implemented');
    }
}

export class ProviderCasbinAuthorizerFactory implements ProviderAuthorizerFactory {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async createAuthorizer(provider: Provider): Promise<Authorizer> {
        if (!provider || !provider.authModel || !provider.policy) {
            throw new PermissionDeniedError();
        }
        const authorizer = new CasbinAuthorizer(this.logger, provider.authModel, provider.policy);
        await authorizer.init();
        return authorizer;
    }
}
