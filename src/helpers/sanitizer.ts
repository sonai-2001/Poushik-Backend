/* eslint-disable @typescript-eslint/no-unused-vars */
export function sanitizeUpdatePayload<T extends object>(payload: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(payload).filter(
            ([_, value]) => value !== undefined && value !== null && value !== '',
        ),
    ) as Partial<T>;
}
