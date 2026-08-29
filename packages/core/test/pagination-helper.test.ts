import { paginateWithFilter } from "../src";

describe("paginateWithFilter", () => {
  it("scans additional raw pages until the requested filtered page is full", async () => {
    const pages = [{ items: [1, 2, 3, 4, 5], nextCursor: "page-2" }, { items: [6, 7, 8, 9, 10] }];
    const result = await paginateWithFilter({
      pageSize: 5,
      fetchPage: async (cursor) => {
        const page = cursor === undefined ? pages[0] : pages[1];
        if (page === undefined) throw new Error("Unexpected page request.");
        return { rawItems: page.items, ...(page.nextCursor === undefined ? {} : { rawNextCursor: page.nextCursor }) };
      },
      filterPredicate: (item) => item % 2 === 0,
      encodeCursor: (item) => `item-${item}`
    });

    expect(result).toEqual({
      items: [2, 4, 6, 8, 10],
      hasMore: false,
      totalScannedCount: 10
    });
  });
});
