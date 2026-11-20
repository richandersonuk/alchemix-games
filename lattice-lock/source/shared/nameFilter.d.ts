export declare const NAME_MIN: number;
export declare const NAME_MAX: number;
export declare function checkName(input: unknown): { ok: true; name: string } | { ok: false; reason: 'length' | 'charset' | 'blocked' };
export declare function randomAlias(): string;
