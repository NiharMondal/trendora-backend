interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalData: number;
}

class PrismaQueryBuilder<TWhereInput> {
	private whereConditions: TWhereInput[] = [];
	private defaultFilter: Partial<TWhereInput> = {};
	private page = 1;
	private limit = 10;
	private orderByCondition: Record<string, "asc" | "desc"> = {};
	private skip = 0;

	constructor(private query: Record<string, any>) {}

	/**
	 * Add a default filter (e.g., isDeleted: false)
	 */
	withDefaultFilter(filter: Partial<TWhereInput>) {
		this.defaultFilter = filter;
		return this;
	}

	/**
	 * Search in given fields (case-insensitive)
	 */
	search(fields: (keyof TWhereInput)[]) {
		if (this.query.search) {
			const searchValue = this.query.search;
			this.whereConditions.push({
				OR: fields.map((field) => ({
					[field]: {
						contains: searchValue,
						mode: "insensitive",
					},
				})) as any,
			} as unknown as TWhereInput);
		}
		return this;
	}

	/**
	 * Filter exact matches or multiple values
	 */
	filter() {
		const excluded = ["search", "page", "limit", "sortBy", "orderBy"];
		const others = { ...this.query };
		excluded.forEach((key) => delete others[key]);

		if (Object.keys(others).length > 0) {
			this.whereConditions.push({
				AND: Object.entries(others).map(([key, value]) => {
					if (String(value).includes(",")) {
						return {
							[key]: {
								in: decodeURIComponent(value).split(","),
							},
						};
					}
					return { [key]: value };
				}),
			} as any);
		}
		return this;
	}

	/**
	 * Numeric range filtering
	 */
	range(field: keyof TWhereInput, minMaxString?: string) {
		if (minMaxString) {
			const [min, max] = minMaxString.split(",");
			this.whereConditions.push({
				[field]: {
					gte: Number(min),
					lte: Number(max),
				},
			} as any);
		}
		return this;
	}

	/**
	 * Pagination
	 */
	paginate() {
		this.page = Number(this.query.page) || 1;
		this.limit = Number(this.query.limit) || 10;
		this.skip = (this.page - 1) * this.limit;
		return this;
	}

	/**
	 * Sorting
	 */
	sort(
		defaultField: string = "createdAt",
		defaultOrder: "asc" | "desc" = "asc"
	) {
		if (this.query.sortBy) {
			this.orderByCondition = {
				[this.query.sortBy]:
					(this.query.orderBy as "asc" | "desc") || "asc",
			};
		} else {
			this.orderByCondition = { [defaultField]: defaultOrder };
		}
		return this;
	}

	/**
	 * Build final Prisma args
	 */
	build() {
		// Always push default filter if provided
		if (Object.keys(this.defaultFilter).length > 0) {
			this.whereConditions.push(this.defaultFilter as TWhereInput);
		}

		return {
			where: { AND: this.whereConditions } as any as TWhereInput,
			skip: this.skip,
			take: this.limit,
			orderBy: this.orderByCondition,
		};
	}

	/**
	 * Meta info
	 */
	async getMeta(prismaModel: any) {
		// Include default filter in count as well
		if (Object.keys(this.defaultFilter).length > 0) {
			this.whereConditions.push(this.defaultFilter as TWhereInput);
		}

		const totalData = await prismaModel.count({
			where: { AND: this.whereConditions } as any,
		});
		const totalPages = Math.ceil(totalData / this.limit);
		return {
			currentPage: this.page,
			totalPages,
			totalData,
		} as PaginationMeta;
	}
}

export default PrismaQueryBuilder;
