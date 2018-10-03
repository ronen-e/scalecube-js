// @flow
import { Observable } from 'rxjs';
import { Transport as TransportInterface } from './api/Transport';
import { errors } from './errors';
import { TransportClientProvider } from './api/TransportClientProvider';
import { TransportServerProvider } from './api/TransportServerProvider';
import { TransportClientProviderConfig, TransportServerProviderConfig, TransportRequest } from './api/types';

export class Transport implements TransportInterface {
  _clientProvider: any;
  _serverProvider: any;

  constructor() {
    this._clientProvider = null;
    this._serverProvider = null;
    return this;
  }

  // TODO Can we split it to setClientProvider and setServerProvider ?
  setProvider(Provider: Class<TransportClientProvider | TransportServerProvider>, transportProviderConfig: TransportClientProviderConfig | TransportServerProviderConfig): Promise<void> {
    const provider = new Provider();
    return provider.build(transportProviderConfig).then(() => {
      if (typeof provider.request === 'function') {
        this._clientProvider = provider;
      }
      if (typeof provider.listen === 'function') {
        this._serverProvider = provider;
      }
    });
  }

  removeProvider(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._clientProvider && !this._serverProvider) {
        return reject(new Error(errors.noProvider));
      }
      if (this._clientProvider && this._serverProvider) {
        return Promise.all([this._clientProvider.destroy(), this._serverProvider.destroy()])
          .then(() => {
            this._clientProvider = null;
            this._serverProvider = null;
            resolve();
          })
          .catch(reject)
      } else if (this._clientProvider) {
        this._clientProvider.destroy()
          .then(() => {
            this._clientProvider = null;
            resolve();
          })
          .catch(reject);
      } else if (this._serverProvider) {
        this._serverProvider.destroy()
          .then(() => {
            this._serverProvider = null;
            resolve();
          })
          .catch(reject);
      }
    });
  }

  request(transportRequest: TransportRequest): Observable<any> {
    if (!this._clientProvider) {
      return Observable.throw(new Error(errors.noProvider));
    }
    return this._clientProvider.request(transportRequest);
  }

  listen(path: string, callback: (transportRequest: TransportRequest) => Observable<any>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._serverProvider) {
        return reject(new Error(errors.noProvider));
      }
      if (typeof callback !== 'function') {
        return reject(new Error(errors.wrongCallbackForListen));
      }
      this._serverProvider.listen(path, callback);
      resolve();
    });
  }

}


