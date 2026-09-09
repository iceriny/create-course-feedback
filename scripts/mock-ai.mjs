// Local-only provider used for browser acceptance checks. No external requests.
import http from "node:http";
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ data: [{ id: "local-test" }] })); return; }
  let body = "";
  for await (const chunk of req) body += chunk;
  let input;
  try { input = JSON.parse(body); } catch { res.writeHead(400); res.end(); return; }
  if (input.model === "error-test") { res.writeHead(401); res.end(JSON.stringify({ error: "test authentication error" })); return; }
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const text = "本次课堂中，该同学能根据提示完成练习，并认真检查运行结果。建议课后再独立尝试一次，巩固课堂学习内容。";
  const frames = [...text].map(content => Buffer.from(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
  let index = 0;
  const timer = setInterval(() => {
    if (index === frames.length) { clearInterval(timer); res.end("data: [DONE]\n\n"); return; }
    const frame = frames[index++];
    res.write(frame.subarray(0, 19)); res.write(frame.subarray(19));
  }, input.model === "slow-test" ? 300 : 15);
  res.on("close", () => clearInterval(timer));
});
server.listen(5199, "127.0.0.1", () => console.log("Mock AI: http://127.0.0.1:5199/v1/chat/completions"));
