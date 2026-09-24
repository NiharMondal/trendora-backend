import CustomError from "@/utils/customError";

/**
 * `?startDate=&endDate=` from a query string, for the analytics endpoints.
 *
 * `new Date("garbage")` is an Invalid Date, which Prisma rejects with a 500, so
 * a bad value is a 400 here instead. Either bound may be omitted; callers apply
 * a range only when both are present.
 */
export const parseDateRange = (query: Record<string, unknown>) => {
    const parse = (value: unknown, name: string) => {
        if (value === undefined || value === "") return undefined;

        const date = new Date(String(value));
        if (Number.isNaN(date.getTime())) {
            throw new CustomError(400, `${name} must be a valid date`);
        }
        return date;
    };

    const startDate = parse(query.startDate, "startDate");
    const endDate = parse(query.endDate, "endDate");

    if (startDate && endDate && startDate > endDate) {
        throw new CustomError(400, "startDate must be before endDate");
    }

    return { startDate, endDate };
};
