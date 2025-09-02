export function find({ this: { connection, columns, constructor }, results, populates, print, Schema }: {
    this: {
        connection: any;
        columns: any;
        constructor: any;
    };
    results: any;
    populates: any;
    print?: boolean;
    Schema: any;
}): Promise<any>;
export function typeAndColumn(populateType: any): {
    isFK: boolean;
    refType: any;
    refColumn: any;
} | {
    refType: any;
    refColumn: any;
    isFK?: undefined;
} | {
    refType: any;
    isFK?: undefined;
    refColumn?: undefined;
};
export function reducer(struct: {}, options: any, callback: any, initValue: any[], superValue: any): Promise<any>;
