import { createHash } from "node:crypto";
import { Prisma, type Photo } from "@prisma/client";
// A stable asset/destination identity makes retries and copying a copy idempotent.
export function copiedPhotoID(
  photo: Pick<
    Photo,
    "userID" | "ossFileName" | "largeURL" | "smallURL" | "timestamp"
  >,
  projectID: number,
) {
  return (
    "webcopy_" +
    createHash("sha256")
      .update(
        JSON.stringify([
          photo.userID,
          photo.ossFileName,
          photo.largeURL,
          photo.smallURL,
          String(photo.timestamp),
          projectID,
        ]),
      )
      .digest("hex")
      .slice(0, 48)
  );
}
export function copyPhotoData(
  photo: Photo,
  target: { projectID: number; projectName: string; groupID: string },
): Prisma.PhotoCreateManyInput {
  const { createdAt, updatedAt, deletedAt, ...fields } = photo;
  return {
    ...fields,
    photoID: copiedPhotoID(photo, target.projectID),
    ...target,
    timeInfo: photo.timeInfo ?? Prisma.DbNull,
    addressInfo: photo.addressInfo ?? Prisma.DbNull,
    watermarkInfo: photo.watermarkInfo ?? Prisma.DbNull,
    systemInfo: photo.systemInfo ?? Prisma.DbNull,
    mediaInfo: photo.mediaInfo ?? Prisma.DbNull,
    attendanceInfo: photo.attendanceInfo ?? Prisma.DbNull,
  };
}
