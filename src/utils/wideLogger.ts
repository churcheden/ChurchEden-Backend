import { AsyncLocalStorage } from "async_hooks";

export interface WideLogContext {
    ts: string,
    sev: 'INFO' | 'ERROR' | 'WARN',
    msg: string,
    trace: {
        trace_id?: string,
        span_id?: string,
        parent_id?: string | undefined,
    },
    http: {
        method: string,
        route: string,
        path: string,
        status?: number,
        duration_ms?: number,
        user_agent?: string,
        ip?: string
    },
    user?: {
        id: string,
        email: string,
    },
    ctx: Record<string, unknown>,
    host: {
        name: string,
        region?: string,
        ver?: string
    },
    err?: {
        code?: string,
        message: string,
        stack: string
    }
};

const storage = new AsyncLocalStorage<WideLogContext>();

export const wideLogger = {
    init: (context: WideLogContext, callback: () => void) => {
        storage.run(context, callback)
    },

    get: (): WideLogContext | undefined => {
        return storage.getStore();
    },

    add: (section: keyof WideLogContext, data: Record<string, unknown>) => {
        const store = storage.getStore();

        if(store) {
            if( section === 'ctx' || section === 'http' || section === 'user' || section === 'err' || section === 'trace') {
                (store[section] as Record<string, unknown>) = { ...(store[section] as Record<string, unknown>), ...data };
            }else {
                (store[section] as Record<string, unknown>)[section] = data;
            }
        }
    },

    addCtx: (key: string, value: unknown) => {
        const store = storage.getStore();
        if(store) {
            store.ctx[key] = value;
        };
    }
};