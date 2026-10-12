const net = require("net");

async function main() {
  const { Aedes } = await import("aedes");
  const aedes = await Aedes.createBroker();
  const PORT = 1883;
  const HOST = "0.0.0.0";

  const server = net.createServer(aedes.handle.bind(aedes));

  server.listen(PORT, HOST, () => {
    console.log(`\n==================================================`);
    console.log(`✓ SmartNeb Local Dev MQTT Broker (Aedes) listening on ${HOST}:${PORT}`);
    console.log(`✓ Ready for ESP32 hardware & simulator connections`);
    console.log(`==================================================\n`);
  });

  aedes.on("client", (client) => {
    console.log(`🟢 [MQTT Broker] Client Connected: ${client ? client.id : "unknown"}`);
  });

  aedes.on("clientDisconnect", (client) => {
    console.log(`🔴 [MQTT Broker] Client Disconnected: ${client ? client.id : "unknown"}`);
  });

  aedes.on("publish", (packet, client) => {
    if (client) {
      console.log(`📡 [MQTT Broker] Published on [${packet.topic}]: ${packet.payload.toString()}`);
    }
  });
}

main().catch((err) => {
  console.error("Failed to start MQTT broker:", err);
  process.exit(1);
});
