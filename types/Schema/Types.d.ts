export class Base {
    static validate(value: any): boolean;
}
export class PK {
    static validate(): boolean;
}
declare function FKGenerator(model: any, column: any): {
    new (): {};
    get model(): any;
    get column(): any;
    get _refType(): any;
    validate(value: any): any;
    inputMapper(value: any): any;
};
export class Point {
    static get regex(): RegExp;
    static validate(value: any): boolean;
    static inputMapper(value: any): any;
    static rangeValidator({ x, y }: {
        x: any;
        y: any;
    }): boolean;
}
export class Polygon {
    static _isObjectArray(arr: any): boolean;
    static _isAllContentsHasValue(arr: any): boolean;
    static validate(value: any): boolean;
    static inputMapper(value: any): any;
}
declare function EnumGenerator(...values: any[]): {
    new (): {};
    get enum(): any[];
    validate(value: any): boolean;
};
declare class Num extends Number {
    static validate(number: any): boolean;
}
declare class Str extends String {
    static validate(string: any): string is string;
}
export class JSONString extends Str {
    static validate(value: any): boolean;
    static inputMapper(value: any): any;
}
export class NumberString extends Str {
    static validate(string: any): boolean;
}
export class Email extends String {
    static validate(string: any): boolean;
}
export class URL extends Str {
    static validate(string: any): boolean;
}
export class UNIX_TIMESTAMP {
    static validate(value: any): boolean;
    static inputMapper(value: any): number;
}
export class DateTime {
    static validate(value: any): boolean;
    static inputMapper(value: any): string;
}
export { FKGenerator as FK, EnumGenerator as ENUM, Num as Number, Str as String };
