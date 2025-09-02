export = Encryption;
declare class Encryption {
    static buffered({ key, iv }: {
        key: any;
        iv: any;
    }): {
        key: Buffer<ArrayBuffer>;
        iv: Buffer<ArrayBuffer>;
    };
    static encrypt(text: any, secret?: {
        key: string;
        iv: string;
    }): string;
    static decrypt(text: any, secret?: {
        key: string;
        iv: string;
    }): string;
}
