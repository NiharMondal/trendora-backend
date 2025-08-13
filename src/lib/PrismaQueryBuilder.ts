interface PaginationMeta {
	currentPage: number;
	totalPages: number;
	totalData: number;
}

class PrismaQueryBuilder<TWhereInput> {
	private whereConditions: TWhereInput[] = [];
	private page = 1;
	private limit = 10;
	private orderByCondition: Record<string, "asc" | "desc"> = {};
	private skip = 0;

	constructor(private query: Record<string, any>) {}

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
				})),
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
	 * Filter by numeric range
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
	 * Add pagination
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
	 * Get the final Prisma args
	 */
	build() {
		return {
			where: { AND: this.whereConditions } as any as TWhereInput,
			skip: this.skip,
			take: this.limit,
			orderBy: this.orderByCondition,
		};
	}

	/**
	 * Meta calculation
	 */
	async getMeta(prismaModel: any) {
		const totalData = await prismaModel.count({
			where: { AND: this.whereConditions } as any,
		});
		const totalPages = Math.ceil(totalData / this.limit);
		return {
			currentPage: this.page,
			totalData,
			totalPages,
		} as PaginationMeta;
	}
}

export default PrismaQueryBuilder;
