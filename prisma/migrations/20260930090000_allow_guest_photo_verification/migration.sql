-- Allow anonymous verification tasks while retaining ownership of existing tasks.
ALTER TABLE `PhotoVerificationTask` DROP FOREIGN KEY `PhotoVerificationTask_userID_fkey`;
ALTER TABLE `PhotoVerificationTask` MODIFY `userID` VARCHAR(191) NULL;
ALTER TABLE `PhotoVerificationTask` ADD CONSTRAINT `PhotoVerificationTask_userID_fkey`
  FOREIGN KEY (`userID`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
