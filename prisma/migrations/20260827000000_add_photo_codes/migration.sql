-- CreateTable
CREATE TABLE `PhotoCode` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(14) NOT NULL,
    `batchID` VARCHAR(191) NOT NULL,
    `userID` VARCHAR(191) NOT NULL,
    `deviceID` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PhotoCode_code_key`(`code`),
    INDEX `PhotoCode_batchID_idx`(`batchID`),
    INDEX `PhotoCode_userID_expiresAt_idx`(`userID`, `expiresAt`),
    INDEX `PhotoCode_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PhotoCode` ADD CONSTRAINT `PhotoCode_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
