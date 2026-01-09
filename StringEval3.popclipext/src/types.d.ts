declare module 'google-libphonenumber' {
    export class PhoneNumberUtil {
        static getInstance(): PhoneNumberUtil;
        parse(text: string, region: string): any;
        isValidNumber(number: any): boolean;
        format(number: any, format: number): string;
    }
    export const PhoneNumberFormat: {
        E164: number;
        INTERNATIONAL: number;
        NATIONAL: number;
        RFC3966: number;
    };
}
