-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `appleUserID` VARCHAR(191) NULL,
    `googleUserID` VARCHAR(191) NULL,
    `zaloUserID` VARCHAR(191) NULL,
    `userName` VARCHAR(191) NULL,
    `shortName` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `selectedGroupID` VARCHAR(191) NULL,
    `selectedProjectID` INTEGER NULL,
    `appInstanceID` VARCHAR(191) NULL,
    `App-Version` VARCHAR(191) NULL,
    `versionCode` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NULL,
    `device_id` VARCHAR(191) NULL,
    `App-UUID` VARCHAR(191) NULL,
    `device model` VARCHAR(191) NULL,
    `realTimeZone` VARCHAR(191) NULL,
    `systemTimeZone` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `appLan` VARCHAR(191) NULL,
    `fullapplan` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_appleUserID_key`(`appleUserID`),
    UNIQUE INDEX `User_googleUserID_key`(`googleUserID`),
    UNIQUE INDEX `User_zaloUserID_key`(`zaloUserID`),
    INDEX `User_selectedGroupID_idx`(`selectedGroupID`),
    INDEX `User_selectedProjectID_idx`(`selectedProjectID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationCode` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VerificationCode_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebLoginCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebLoginCode_userId_idx`(`userId`),
    INDEX `WebLoginCode_code_idx`(`code`),
    INDEX `WebLoginCode_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebQrLoginSession` (
    `id` VARCHAR(191) NOT NULL,
    `scanToken` VARCHAR(191) NOT NULL,
    `browserSecretHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `webSessionToken` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebQrLoginSession_scanToken_key`(`scanToken`),
    UNIQUE INDEX `WebQrLoginSession_browserSecretHash_key`(`browserSecretHash`),
    UNIQUE INDEX `WebQrLoginSession_webSessionToken_key`(`webSessionToken`),
    INDEX `WebQrLoginSession_userId_idx`(`userId`),
    INDEX `WebQrLoginSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `appInstanceID` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_token_key`(`token`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `groupID` VARCHAR(191) NOT NULL,
    `groupName` VARCHAR(191) NOT NULL,
    `ownerID` VARCHAR(191) NOT NULL,
    `memberSubscriptionInfo` JSON NULL,
    `accessControl` JSON NULL,
    `syncNum` INTEGER NOT NULL DEFAULT 0,
    `isNew` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Team_ownerID_idx`(`ownerID`),
    INDEX `Team_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`groupID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamMember` (
    `id` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `userID` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `roleID` INTEGER NOT NULL DEFAULT 3,
    `userSettings` JSON NULL,
    `photoCount` INTEGER NOT NULL DEFAULT 0,
    `latestPhotoTimeInterval` INTEGER NULL,
    `latestPhotoTimestamp` BIGINT NULL,
    `latestPhotoSmallURL` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamMember_userID_idx`(`userID`),
    INDEX `TeamMember_groupID_role_idx`(`groupID`, `role`),
    UNIQUE INDEX `TeamMember_groupID_userID_key`(`groupID`, `userID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamInviteLink` (
    `id` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `uuID` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `roleID` INTEGER NOT NULL DEFAULT 3,
    `inviteLinkWay` ENUM('LINK', 'EMAIL') NOT NULL DEFAULT 'LINK',
    `expiresAt` DATETIME(3) NULL,
    `disabledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeamInviteLink_uuID_key`(`uuID`),
    INDEX `TeamInviteLink_groupID_idx`(`groupID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamInviteCode` (
    `id` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `roleID` INTEGER NOT NULL DEFAULT 3,
    `expiresAt` DATETIME(3) NULL,
    `disabledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeamInviteCode_code_key`(`code`),
    INDEX `TeamInviteCode_groupID_idx`(`groupID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamEmailInvite` (
    `id` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `inviterID` VARCHAR(191) NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `roleID` INTEGER NOT NULL DEFAULT 3,
    `uuID` VARCHAR(191) NULL,
    `inviteCode` VARCHAR(191) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TeamEmailInvite_inviteCode_key`(`inviteCode`),
    INDEX `TeamEmailInvite_groupID_idx`(`groupID`),
    INDEX `TeamEmailInvite_email_idx`(`email`),
    INDEX `TeamEmailInvite_inviterID_idx`(`inviterID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhotoPdfSetting` (
    `id` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `iconOpen` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PhotoPdfSetting_groupID_key`(`groupID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamSetting` (
    `id` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamSetting_groupID_idx`(`groupID`),
    INDEX `TeamSetting_name_idx`(`name`),
    UNIQUE INDEX `TeamSetting_groupID_name_key`(`groupID`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `projectID` INTEGER NOT NULL AUTO_INCREMENT,
    `groupID` VARCHAR(191) NOT NULL,
    `projectName` VARCHAR(191) NOT NULL,
    `photoCount` INTEGER NOT NULL DEFAULT 0,
    `latestPhotoTimestamp` BIGINT NULL,
    `latestPhotoSmallURL` VARCHAR(191) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `address` VARCHAR(191) NULL,
    `circle` INTEGER NULL,
    `distanceUnit` VARCHAR(191) NULL,
    `removeAddress` BOOLEAN NOT NULL DEFAULT false,
    `microBind` JSON NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_groupID_idx`(`groupID`),
    INDEX `Project_groupID_deletedAt_idx`(`groupID`, `deletedAt`),
    PRIMARY KEY (`projectID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMember` (
    `id` VARCHAR(191) NOT NULL,
    `projectID` INTEGER NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `userID` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `roleID` INTEGER NOT NULL DEFAULT 3,
    `accessControl` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProjectMember_groupID_userID_idx`(`groupID`, `userID`),
    INDEX `ProjectMember_userID_idx`(`userID`),
    UNIQUE INDEX `ProjectMember_projectID_userID_key`(`projectID`, `userID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Photo` (
    `photoID` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `projectID` INTEGER NULL,
    `userID` VARCHAR(191) NOT NULL,
    `mediaType` INTEGER NOT NULL DEFAULT 0,
    `timestamp` BIGINT NOT NULL,
    `takePhotoFormatTime` VARCHAR(191) NOT NULL,
    `takePhotoTimezoneID` VARCHAR(191) NOT NULL,
    `duration` INTEGER NULL,
    `largeURL` VARCHAR(191) NULL,
    `smallURL` VARCHAR(191) NULL,
    `userName` VARCHAR(191) NULL,
    `userShortName` VARCHAR(191) NULL,
    `userAvatar` VARCHAR(191) NULL,
    `projectName` VARCHAR(191) NULL,
    `antiFakeCode` VARCHAR(191) NULL,
    `ossFileName` VARCHAR(191) NOT NULL,
    `localPhotoName` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `watermarkID` VARCHAR(191) NULL,
    `watermarkBaseID` VARCHAR(191) NULL,
    `saveToDevice` INTEGER NULL,
    `timeInfo` JSON NULL,
    `addressInfo` JSON NULL,
    `watermarkInfo` JSON NULL,
    `systemInfo` JSON NULL,
    `mediaInfo` JSON NULL,
    `attendanceInfo` JSON NULL,
    `searchText` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Photo_groupID_timestamp_idx`(`groupID`, `timestamp`),
    INDEX `Photo_projectID_timestamp_idx`(`projectID`, `timestamp`),
    INDEX `Photo_userID_timestamp_idx`(`userID`, `timestamp`),
    INDEX `Photo_mediaType_idx`(`mediaType`),
    INDEX `Photo_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`photoID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamFeed` (
    `feedID` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `projectID` INTEGER NULL,
    `photoID` VARCHAR(191) NULL,
    `createdByUserID` VARCHAR(191) NULL,
    `feedType` ENUM('TEXT', 'PHOTO', 'SYSTEM') NOT NULL DEFAULT 'TEXT',
    `title` VARCHAR(191) NULL,
    `content` TEXT NULL,
    `payload` JSON NULL,
    `commentCount` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamFeed_groupID_createdAt_idx`(`groupID`, `createdAt`),
    INDEX `TeamFeed_groupID_projectID_createdAt_idx`(`groupID`, `projectID`, `createdAt`),
    INDEX `TeamFeed_createdByUserID_idx`(`createdByUserID`),
    INDEX `TeamFeed_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`feedID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamFeedPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `feedID` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `photoID` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamFeedPhoto_groupID_createdAt_idx`(`groupID`, `createdAt`),
    INDEX `TeamFeedPhoto_photoID_idx`(`photoID`),
    UNIQUE INDEX `TeamFeedPhoto_feedID_photoID_key`(`feedID`, `photoID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamFeedComment` (
    `commentID` VARCHAR(191) NOT NULL,
    `feedID` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `userID` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamFeedComment_feedID_createdAt_idx`(`feedID`, `createdAt`),
    INDEX `TeamFeedComment_groupID_createdAt_idx`(`groupID`, `createdAt`),
    INDEX `TeamFeedComment_userID_idx`(`userID`),
    INDEX `TeamFeedComment_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`commentID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamFeedLike` (
    `likeID` VARCHAR(191) NOT NULL,
    `feedID` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `userID` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamFeedLike_groupID_createdAt_idx`(`groupID`, `createdAt`),
    INDEX `TeamFeedLike_userID_idx`(`userID`),
    UNIQUE INDEX `TeamFeedLike_feedID_userID_key`(`feedID`, `userID`),
    PRIMARY KEY (`likeID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhotoShare` (
    `id` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `shareKey` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `keepUpdate` BOOLEAN NOT NULL DEFAULT false,
    `willExpire` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `fromPlace` VARCHAR(191) NULL,
    `customMsg` VARCHAR(191) NULL,
    `rangeSelected` JSON NULL,
    `selectedPhotoIDs` JSON NULL,
    `unSelectedPhotoIDs` JSON NULL,
    `filters` JSON NULL,
    `photoCount` INTEGER NOT NULL DEFAULT 0,
    `createdByUserID` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PhotoShare_shareKey_key`(`shareKey`),
    INDEX `PhotoShare_groupID_idx`(`groupID`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhotoPackageTask` (
    `taskID` VARCHAR(191) NOT NULL,
    `groupID` VARCHAR(191) NOT NULL,
    `packageType` INTEGER NOT NULL,
    `packageStatus` INTEGER NOT NULL DEFAULT 0,
    `url` VARCHAR(191) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `title` VARCHAR(191) NULL,
    `timeZone` VARCHAR(191) NULL,
    `rangeSelected` JSON NULL,
    `selectedPhotoIDs` JSON NULL,
    `unSelectedPhotoIDs` JSON NULL,
    `filters` JSON NULL,
    `eventParams` JSON NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,

    INDEX `PhotoPackageTask_groupID_packageType_idx`(`groupID`, `packageType`),
    INDEX `PhotoPackageTask_packageStatus_idx`(`packageStatus`),
    PRIMARY KEY (`taskID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountDeletionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `locale` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AccountDeletionRequest_email_idx`(`email`),
    INDEX `AccountDeletionRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `AccountDeletionRequest_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WebLoginCode` ADD CONSTRAINT `WebLoginCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebQrLoginSession` ADD CONSTRAINT `WebQrLoginSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_ownerID_fkey` FOREIGN KEY (`ownerID`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamInviteLink` ADD CONSTRAINT `TeamInviteLink_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamInviteCode` ADD CONSTRAINT `TeamInviteCode_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamEmailInvite` ADD CONSTRAINT `TeamEmailInvite_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamEmailInvite` ADD CONSTRAINT `TeamEmailInvite_inviterID_fkey` FOREIGN KEY (`inviterID`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhotoPdfSetting` ADD CONSTRAINT `PhotoPdfSetting_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamSetting` ADD CONSTRAINT `TeamSetting_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectID_fkey` FOREIGN KEY (`projectID`) REFERENCES `Project`(`projectID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_groupID_userID_fkey` FOREIGN KEY (`groupID`, `userID`) REFERENCES `TeamMember`(`groupID`, `userID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_projectID_fkey` FOREIGN KEY (`projectID`) REFERENCES `Project`(`projectID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeed` ADD CONSTRAINT `TeamFeed_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeed` ADD CONSTRAINT `TeamFeed_projectID_fkey` FOREIGN KEY (`projectID`) REFERENCES `Project`(`projectID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeed` ADD CONSTRAINT `TeamFeed_photoID_fkey` FOREIGN KEY (`photoID`) REFERENCES `Photo`(`photoID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeed` ADD CONSTRAINT `TeamFeed_createdByUserID_fkey` FOREIGN KEY (`createdByUserID`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedPhoto` ADD CONSTRAINT `TeamFeedPhoto_feedID_fkey` FOREIGN KEY (`feedID`) REFERENCES `TeamFeed`(`feedID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedPhoto` ADD CONSTRAINT `TeamFeedPhoto_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedPhoto` ADD CONSTRAINT `TeamFeedPhoto_photoID_fkey` FOREIGN KEY (`photoID`) REFERENCES `Photo`(`photoID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedComment` ADD CONSTRAINT `TeamFeedComment_feedID_fkey` FOREIGN KEY (`feedID`) REFERENCES `TeamFeed`(`feedID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedComment` ADD CONSTRAINT `TeamFeedComment_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedComment` ADD CONSTRAINT `TeamFeedComment_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedLike` ADD CONSTRAINT `TeamFeedLike_feedID_fkey` FOREIGN KEY (`feedID`) REFERENCES `TeamFeed`(`feedID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedLike` ADD CONSTRAINT `TeamFeedLike_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamFeedLike` ADD CONSTRAINT `TeamFeedLike_userID_fkey` FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhotoShare` ADD CONSTRAINT `PhotoShare_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhotoPackageTask` ADD CONSTRAINT `PhotoPackageTask_groupID_fkey` FOREIGN KEY (`groupID`) REFERENCES `Team`(`groupID`) ON DELETE CASCADE ON UPDATE CASCADE;
