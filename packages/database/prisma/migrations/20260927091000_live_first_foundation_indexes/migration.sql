-- Cover the new collection and editorial-configuration foreign keys with
-- direct indexes. This is additive and does not touch imported data.

CREATE INDEX "ContentCollectionItem_recordingId_idx"
  ON "ContentCollectionItem"("recordingId");

CREATE INDEX "HomeBlockConfiguration_collectionId_idx"
  ON "HomeBlockConfiguration"("collectionId");
