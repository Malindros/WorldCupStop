export type RouteParams<TParams extends Record<string, string> = Record<string, string>> = {
    params: Promise<TParams>;
};

export type JsonObject = Record<string, unknown>;

export type JsonBody<TBody extends JsonObject> = TBody | null;
