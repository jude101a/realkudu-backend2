export const errorHandler = (err, req, res, next) => {
  // Log full error server-side
  console.error(err);

  // Mask known DB/network errors to avoid leaking internals to clients
  const message = (() => {
    const m = String(err?.message || "");
    if (m.includes("connection terminated unexpectedly") || m.includes("ssl/tls required") || m.includes("ssl required") || err?.code === "ECONNRESET" || err?.code === "ECONNREFUSED") {
      return "Service temporarily unavailable";
    }
    return err?.publicMessage || err?.message || "Internal Server Error";
  })();

  res.status(err.status || 500).json({ success: false, message });
};
