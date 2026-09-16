import { exportResponsesToCsv } from "@form-engine-ts/core";
import { createStorageContractFixtures, verifyStorageCodecVectors } from "../src/testing";

it("publishes deterministic CSV and cursor vectors", () => {
  const { schema, submissions, csv } = createStorageContractFixtures();
  expect(exportResponsesToCsv(schema, submissions, csv.options)).toBe(csv.expected);
  verifyStorageCodecVectors();
});
