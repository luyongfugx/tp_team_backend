CREATE TABLE `AIReportShare` (
 `id` VARCHAR(191) NOT NULL, `shareKey` VARCHAR(48) NOT NULL,
 `ownerHash` CHAR(64) NOT NULL, `reportId` VARCHAR(120) NOT NULL,
 `revision` INTEGER NOT NULL, `contentHash` CHAR(64) NOT NULL,
 `title` VARCHAR(500) NOT NULL, `language` VARCHAR(32) NOT NULL,
 `document` JSON NOT NULL, `closedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `AIReportShare_shareKey_key` (`shareKey`),
 UNIQUE INDEX `AIReportShare_ownerHash_reportId_key` (`ownerHash`,`reportId`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `AIReportSharePage` (
 `id` VARCHAR(191) NOT NULL, `shareId` VARCHAR(191) NOT NULL, `position` INTEGER NOT NULL,
 `width` INTEGER NOT NULL, `height` INTEGER NOT NULL, `jpeg` LONGBLOB NOT NULL,
 UNIQUE INDEX `AIReportSharePage_shareId_position_key` (`shareId`,`position`), PRIMARY KEY (`id`),
 CONSTRAINT `AIReportSharePage_shareId_fkey` FOREIGN KEY (`shareId`) REFERENCES `AIReportShare` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
