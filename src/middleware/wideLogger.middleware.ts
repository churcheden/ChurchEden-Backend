import type { Request, Response, NextFunction } from "express";
import { wideLogger, type WideLogContext } from "../utils/wideLogger.js";
import { randomUUID } from 'crypto';
import os from 'os';
import { env } from "../env.js";
import { logger } from "../utils/logger.js";

export const wideLoggerMiddleware = async(req: Request, res:Response, next: NextFunction) => {
    const start = process.hrtime();

    const initialContext: WideLogContext = {
        ts: new Date().toISOString(),
        sev: 'INFO',
        msg: 'http_request_finished',
        trace: {
            trace_id: randomUUID(),
            span_id: randomUUID(), 
            parent_id: req.get('X-Parent-Span-Id') || undefined,
        },
        http: {
            method: req.method,
            route: req.path,
            path: req.path,
            user_agent: req.headers['user-agent'] || '',
            ip: req.ip || ''
        },
        ctx: {},
        host: {
            name: os.hostname(),
            ver: env.NPM_PACKAGE_VERSION,
        },
    };

    wideLogger.init(initialContext, () => {
        res.on('finish', () => {
            const store = wideLogger.get();
            if(!store) return;

            const diff = process.hrtime(start);
            const durationMs = (diff[0] * 1e9 + diff[1])/ 1e6;

            store.http.status = res.statusCode;
            store.http.duration_ms = durationMs;

            if(req.route) {
                store.http.route = req.baseUrl + req.route.path;
            };

            if (res.statusCode >= 500) {
                logger.error(store, 'http_request_finished');
            } else if (res.statusCode >= 400) {
                logger.warn(store, 'http_request_finished');
            } else {
                logger.info(store, 'http_request_finished');
            }
        });

        next();
    });
};