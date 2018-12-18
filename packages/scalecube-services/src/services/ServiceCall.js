// @flow

import { Router, Message, utils, Microservices } from ".";
import { Observable } from "rxjs/Observable";
import { pipe } from "rxjs/util/pipe";
import "rxjs/add/operator/switchMap";
import "rxjs/add/operator/map";
import "rxjs/add/operator/do";
import "rxjs/add/operator/toPromise";
import "rxjs/add/observable/from";
import { isObservable } from "./utils";

export class ServiceCall {
    router: Router;
    microservices: Microservices;

    constructor(router: Router, ms: Microservices) {
        this.router = router;
        this.microservices = ms;
    }

    call(message: Message, type: "Observable" | "Promise") {
        const chain$ = Observable
            .from([message])
            .map((message) => {
                if (Array.isArray(message.data)) {
                    return message;
                }
                throw Error("Message format error: data must be Array");
            })
            .map(message => {
                const inst = this.router.route && this.router.route(message);
                if (inst && inst.service) {
                    return ({
                        message,
                        inst,
                    })
                }
                throw Error(`Service not found error: ${message.serviceName}.${message.method}`);
            })
            .map(({ inst, message }) => ({
                inst,
                message,
                thisMs: this.microservices,
                meta: inst.service.meta || inst.service.constructor.meta || {}
            }))
            .pipe(source$ => this.microservices.preRequest(source$))
            .map(obj => obj.inst)
            .switchMap(inst => utils.isLoader(inst) ?
                Observable.from(new Promise(r => inst.service.promise.then(res => r(res)))) :
                Observable.from([inst.service])
            )
            .do((service) => {
                this.microservices.postRequest({ service, message })
            })
            .map((service) => {
                if (service[message.method]) {
                    return service;
                }
                throw Error(`Service not found error: ${message.serviceName}.${message.method}`);
            })
            .switchMap((service) => {
                const serviceMethod = service[message.method](...message.data);
                if ("Promise") {
                    return Observable.from(serviceMethod);
                } else {
                    if (isObservable(serviceMethod)) {
                        return serviceMethod;
                    } else {
                        throw Error(`Service method not observable error: ${message.serviceName}.${message.method}`);
                    }
                }
            });
        return type === "Promise" ? chain$.toPromise() : chain$;
    }

    invoke(message: Message): Promise<Message> {
        return this.call(message, "Promise");
    }

    listen(message: Message): Observable<Message> {
        return this.call(message, "Observable");
    }
}
