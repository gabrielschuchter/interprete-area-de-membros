-- Keep collection membership deterministic under concurrent admin actions.
-- Nullable columns intentionally allow unrelated item types to coexist.
CREATE UNIQUE INDEX "ContentCollectionItem_collectionId_itemType_lessonId_key"
  ON "ContentCollectionItem"("collectionId", "itemType", "lessonId");
CREATE UNIQUE INDEX "ContentCollectionItem_collectionId_itemType_assetId_key"
  ON "ContentCollectionItem"("collectionId", "itemType", "assetId");
CREATE UNIQUE INDEX "ContentCollectionItem_collectionId_itemType_libraryItemId_key"
  ON "ContentCollectionItem"("collectionId", "itemType", "libraryItemId");

ALTER TABLE "HomeBlockConfiguration"
  ADD CONSTRAINT "HomeBlockConfiguration_position_itemCount_check"
  CHECK ("position" >= 0 AND "itemCount" BETWEEN 1 AND 12);
