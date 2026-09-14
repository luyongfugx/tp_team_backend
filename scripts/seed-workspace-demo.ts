import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
const database = new URL(process.env.DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== "/tp_team_backend_local" ||
  process.env.NODE_ENV === "production"
)
  throw new Error(
    "This seed only runs against tp_team_backend_local on localhost",
  );
const prisma = new PrismaClient();
async function main() {
  const owner = await prisma.user.findUnique({
    where: { email: "local-test@example.com" },
  });
  if (!owner)
    throw new Error("Sign in locally as local-test@example.com first");
  const groupID = "local-workspace-demo";
  if (await prisma.team.findUnique({ where: { groupID } })) {
    console.log("Local demo already exists");
    return;
  }
  const people = [owner];
  for (const [email, userName] of [
    ["workspace-demo-lin@example.com", "林工"],
    ["workspace-demo-chen@example.com", "陈师傅"],
  ])
    people.push(
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, userName },
      }),
    );
  await prisma.team.create({
    data: {
      groupID,
      groupName: "城建现场 · 本地演示",
      ownerID: owner.id,
      members: {
        create: people.map((p, i) => ({
          userID: p.id,
          role: i === 0 ? "OWNER" : "MEMBER",
          roleID: i === 0 ? 1 : 3,
        })),
      },
    },
  });
  const projects = [];
  for (const [projectName, address] of [
    ["滨江产业园 · A 栋", "滨江路 128 号 · 主体施工"],
    ["城市更新 · 东街项目", "东街 36 号 · 外立面修缮"],
    ["南站配套 · 景观工程", "南站路 18 号 · 园区绿化"],
    ["北岸仓库 · 待开工", "北岸路 12 号"],
  ])
    projects.push(
      await prisma.project.create({
        data: {
          groupID,
          projectName,
          address,
          members: {
            create: people.map((p, i) => ({
              groupID,
              userID: p.id,
              role: i === 0 ? "OWNER" : "MEMBER",
              roleID: i === 0 ? 1 : 3,
            })),
          },
        },
      }),
    );
  await mkdir("public/workspace-demo", { recursive: true });
  const palettes = [
    ["#c8d6df", "#b3b9b5", "#788786", "#cdbb9e"],
    ["#cbd6cf", "#b8aa8c", "#bcbab0", "#7b8b88"],
    ["#b9c7d3", "#a3aaa5", "#ddd1bb", "#8c967e"],
    ["#ddd7ca", "#bdc1c1", "#8b9a9a", "#b1ae93"],
  ];
  for (let i = 0; i < 12; i++) {
    const [sky, ground, wall, dark] = palettes[i % 4],
      floors = 3 + (i % 4);
    const windows = Array.from(
      { length: floors * 7 },
      (_, n) =>
        `<rect x="${110 + (n % 7) * 62}" y="${90 + Math.floor(n / 7) * 43}" width="35" height="25" fill="${dark}"/><path d="M${128 + (n % 7) * 62} ${90 + Math.floor(n / 7) * 43}v25" stroke="#d7dcd9" stroke-width="2"/>`,
    ).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#edf0e8"/></linearGradient><filter id="grain"><feTurbulence baseFrequency=".6" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><rect width="800" height="600" fill="url(#sky)"/><path d="M0 370L800 310V600H0Z" fill="${ground}"/><path d="M85 65H565V395H85Z" fill="${wall}"/><path d="M565 65L670 110V373L565 395Z" fill="${dark}"/>${windows}<path d="M68 70H580M80 130H580M80 175H580M80 219H580M80 264H580M80 310H580M80 355H580M96 50V418M199 50V413M300 50V406M402 50V400M505 50V397M580 50V392" stroke="#676f68" stroke-width="3" opacity=".6"/><path d="M705 20V360M635 80H789M705 20L635 80M705 20L789 80M756 80V250" fill="none" stroke="#c69642" stroke-width="6"/><path d="M0 450L150 405L455 459L800 398V600H0Z" fill="${dark}" opacity=".35"/><rect x="605" y="383" width="100" height="31" rx="4" fill="#c39858"/><circle cx="625" cy="419" r="15" fill="#4b514d"/><circle cx="684" cy="419" r="15" fill="#4b514d"/><path d="M641 381V347H677V380" fill="#c4ba92"/><rect width="800" height="480" opacity=".12" filter="url(#grain)"/><rect y="480" width="800" height="120" fill="#142421" opacity=".78"/><rect x="24" y="501" width="5" height="73" rx="2" fill="#f09b55"/><text x="43" y="525" fill="white" font-family="Arial,sans-serif" font-size="23" font-weight="700">Timeprint · LOCAL DEMO</text><text x="43" y="553" fill="#d2ded8" font-family="Arial,sans-serif" font-size="15">FIELD RECORD / SITE ${String(i + 1).padStart(2, "0")} / 31.2304, 121.4737</text><text x="43" y="577" fill="#afc3b8" font-family="Arial,sans-serif" font-size="12">Illustrated test fixture · Not a real capture record</text></svg>`;
    await writeFile(`public/workspace-demo/site-${i}.svg`, svg);
  }
  const today = new Date();
  today.setHours(15, 30, 0, 0);
  for (let i = 0; i < 67; i++) {
    const person = people[i % 3],
      project = projects[i % 3],
      timestamp =
        today.getTime() - Math.floor(i / 15) * 86400000 - (i % 15) * 17 * 60000;
    await prisma.photo.create({
      data: {
        photoID: `local-demo-photo-${String(i + 1).padStart(3, "0")}`,
        groupID,
        projectID: project.projectID,
        userID: person.id,
        timestamp: BigInt(timestamp),
        takePhotoFormatTime: new Date(timestamp).toISOString(),
        takePhotoTimezoneID: "Asia/Shanghai",
        smallURL: `/workspace-demo/site-${i % 12}.svg`,
        largeURL: `/workspace-demo/site-${i % 12}.svg`,
        userName: i % 3 === 0 ? "现场负责人" : person.userName,
        projectName: project.projectName,
        localPhotoName: `现场记录-${String(i + 1).padStart(3, "0")}.svg`,
        ossFileName: `local-demo-${i}`,
        location: project.address,
        lat: "31.2304000",
        lng: "121.4737000",
        systemInfo: { deviceModel: "Local demo fixture", os: "Demo" },
        searchText: `${project.projectName} 主体施工 本地演示`,
      },
    });
  }
  console.log(
    "Created local demo: 4 projects, 3 members, 67 illustrated photo fixtures",
  );
}
main().finally(() => prisma.$disconnect());
