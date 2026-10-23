-- Drivers are now identified by their 13-digit "Número de Identidad" instead of their name.
-- Existing drivers have no identity number, so they are deleted along with their movements;
-- run `npm run db:seed` afterwards to load the sample data again.
DELETE FROM "movements";
DELETE FROM "drivers";

-- DropIndex
DROP INDEX "drivers_normalized_name_key";

-- AlterTable
ALTER TABLE "drivers" DROP COLUMN "normalized_name",
ADD COLUMN     "identity_number" CHAR(13) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "drivers_identity_number_key" ON "drivers"("identity_number");
