export = Combine;
declare class Combine {
    isQuering: {};
    waitingCallbacks: {};
    isQuerying(key: any): any;
    bind(key: any): void;
    end(key: any): void;
    subscribe(key: any): Promise<any>;
    publish(key: any, err: any, result: any): Promise<any>;
}
