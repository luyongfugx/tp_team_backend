CREATE TABLE `WorkspaceExport` (
  `id` VARCHAR(191) NOT NULL, `groupID` VARCHAR(191) NOT NULL, `userID` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED', `photoIDs` JSON NOT NULL,
  `groupBy` VARCHAR(191) NOT NULL DEFAULT 'date', `timeZone` VARCHAR(191) NOT NULL DEFAULT 'UTC',
  `total` INTEGER NOT NULL, `processed` INTEGER NOT NULL DEFAULT 0, `succeeded` INTEGER NOT NULL DEFAULT 0,
  `failures` JSON NULL, `error` VARCHAR(191) NULL, `filePath` VARCHAR(191) NULL, `leaseToken` VARCHAR(191) NULL,
  `leaseUntil` DATETIME(3) NULL, `attempts` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, `expiresAt` DATETIME(3) NULL,
  INDEX `WorkspaceExport_userID_groupID_createdAt_idx`(`userID`, `groupID`, `createdAt`),
  INDEX `WorkspaceExport_status_leaseUntil_idx`(`status`, `leaseUntil`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
