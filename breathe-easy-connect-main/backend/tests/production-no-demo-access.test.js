const request = require("supertest");
const { app, prisma } = require("../server");

describe("PART 10 Item 5: Production No-Demo Access Verification", () => {
  const OLD_DEMO_CREDENTIALS = [
    { email: "patient.dimpal@smartneb.com", password: "Password123!" },
    { email: "patient.kalpak@smartneb.com", password: "Password123!" },
    { email: "patient.chandana@smartneb.com", password: "Password123!" },
    { email: "doctor.thorne@smartneb.com", password: "Password123!" },
    { email: "doctor.lin@smartneb.com", password: "Password123!" },
    { email: "caregiver.elena@smartneb.com", password: "Password123!" },
    { email: "caregiver.marcus@smartneb.com", password: "Password123!" },
    { email: "admin.alex@smartneb.com", password: "Password123!" },
    { email: "superadmin.root@smartneb.com", password: "Password123!" },
    { email: "admin@smartneb.com", password: "admin" },
    { email: "root@smartneb.com", password: "root" },
  ];

  beforeAll(async () => {
    // Delete any old seed users from the test database to ensure production simulation is pristine
    await prisma.user.deleteMany({
      where: {
        email: { in: OLD_DEMO_CREDENTIALS.map((c) => c.email) },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  OLD_DEMO_CREDENTIALS.forEach(({ email, password }) => {
    test(`VERIFY NO-DEMO: Login attempt with old demo email [${email}] MUST FAIL in production`, async () => {
      const res = await request(app).post("/api/v1/auth/login").send({ email, password });

      expect(res.statusCode).toBe(401);
      expect(res.body.status).not.toBe("success");
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.error).toMatch(/Invalid credentials/i);
    });
  });
});
