const request = require("supertest");
const { app, prisma } = require("../server");

describe("GATE 1 & 5: Health & Readiness Probes", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("GET /health returns 200 with uptime and status healthy", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.timestamp).toBeDefined();
  });

  test("GET /ready returns 200 with database connected", async () => {
    const res = await request(app).get("/ready");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.database).toBe("connected");
  });
});
