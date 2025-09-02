declare const _exports: Logger;
export = _exports;
declare class Logger {
    _logger: (toPrint: any) => void;
    current(): (toPrint: any) => void;
    set(logLevel: any): void;
}
