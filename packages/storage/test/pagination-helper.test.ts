import { paginateWithFilter } from "../src";

describe("paginateWithFilter", () => {
  it("returns all matches when the source is exhausted before pageSize", async () => {
    const result = await paginateWithFilter({
      pageSize: 5,
      fetchPage: async (cursor) =>
        cursor === undefined ? { rawItems: [1, 2, 3, 4, 5], rawNextCursor: "next" } : { rawItems: [6, 7, 8, 9, 10] },
      filterPredicate: (item) => item % 3 === 0,
      encodeCursor: (item) => `cursor-${item}`
    });

    expect(result).toEqual({ items: [3, 6, 9], hasMore: false, totalScannedCount: 10 });
  });
});
