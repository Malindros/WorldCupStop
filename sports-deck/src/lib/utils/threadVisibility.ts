export function buildThreadWindowWhere(now = new Date()) {
    return {
        AND: [
            {
                OR: [
                    { autoOpenAt: null },
                    { autoOpenAt: { lte: now } },
                ],
            },
            {
                OR: [
                    { autoCloseAt: null },
                    { autoCloseAt: { gte: now } },
                ],
            },
        ],
    };
}

export function buildVisibleThreadWhere(now = new Date()) {
    void now;
    return {
        isHidden: false,
    };
}

type ThreadVisibilityShape = {
    isHidden?: boolean;
    autoOpenAt?: Date | string | null;
    autoCloseAt?: Date | string | null;
} | null | undefined;

export function isThreadWithinWindow(thread: ThreadVisibilityShape, now = new Date()) {
    if (!thread) return false;
    const openOk = !thread.autoOpenAt || new Date(thread.autoOpenAt) <= now;
    const closeOk = !thread.autoCloseAt || new Date(thread.autoCloseAt) >= now;
    return openOk && closeOk;
}

export function isThreadVisible(thread: ThreadVisibilityShape, now = new Date()) {
    if (!thread || thread.isHidden) return false;
    return true;
}
