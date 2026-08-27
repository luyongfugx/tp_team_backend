-- CreateTable
CREATE TABLE `PhotoVerificationTask` (
    `id` VARCHAR(191) NOT NULL,
    `taskID` VARCHAR(191) NOT NULL,
    `userID` VARCHAR(191) NOT NULL,
    `imageUrl` TEXT NOT NULL,
    `imageObjectKey` VARCHAR(1024) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `photoCode` VARCHAR(14) NULL,
    `verified` BOOLEAN NULL,
    `result` JSON NULL,
    `resultObjectKey` VARCHAR(1024) NULL,
    `errorCode` VARCHAR(100) NULL,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PhotoVerificationTask_taskID_key`(`taskID`),
    INDEX `PhotoVerificationTask_userID_createdAt_idx`(`userID`, `createdAt`),
    INDEX `PhotoVerificationTask_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PhotoVerificationTask` ADD CONSTRAINT `PhotoVerificationTask_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
