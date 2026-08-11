-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'AGGREGATOR', 'PROCESSOR', 'LAB', 'MANUFACTURER', 'DISTRIBUTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "BatchStage" AS ENUM ('COLLECTED', 'AGGREGATED', 'PROCESSED', 'LAB_TESTED', 'MANUFACTURED', 'PACKAGED', 'DISTRIBUTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "phone" TEXT,
    "orgName" TEXT,
    "region" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "herbSpecies" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "collectionLat" DOUBLE PRECISION NOT NULL,
    "collectionLng" DOUBLE PRECISION NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "harvestSeason" TEXT,
    "farmerId" TEXT NOT NULL,
    "status" "BatchStage" NOT NULL DEFAULT 'COLLECTED',
    "onChainId" TEXT,
    "creationTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stage" "BatchStage" NOT NULL,
    "actorId" TEXT NOT NULL,
    "notes" TEXT,
    "ipfsCid" TEXT,
    "txHash" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCertificate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "reportIpfsCid" TEXT NOT NULL,
    "reportHash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "testedFor" TEXT[],
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "qrCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBatch" (
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("productId","batchId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchCode_key" ON "Batch"("batchCode");

-- CreateIndex
CREATE INDEX "Batch_herbSpecies_idx" ON "Batch"("herbSpecies");

-- CreateIndex
CREATE INDEX "Batch_status_idx" ON "Batch"("status");

-- CreateIndex
CREATE INDEX "BatchEvent_batchId_idx" ON "BatchEvent"("batchId");

-- CreateIndex
CREATE INDEX "BatchEvent_stage_idx" ON "BatchEvent"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "LabCertificate_eventId_key" ON "LabCertificate"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_qrCode_key" ON "Product"("qrCode");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchEvent" ADD CONSTRAINT "BatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchEvent" ADD CONSTRAINT "BatchEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCertificate" ADD CONSTRAINT "LabCertificate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BatchEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCertificate" ADD CONSTRAINT "LabCertificate_labId_fkey" FOREIGN KEY ("labId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
