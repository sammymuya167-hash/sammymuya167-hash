const products = [
  {
    id: 1,
    name: "Studio headphones",
    category: "Audio",
    price: 8799,
    currency: "KES",
    inStock: true,
  },
  {
    id: 2,
    name: "Mechanical keyboard",
    category: "Accessories",
    price: 6490,
    currency: "KES",
    inStock: true,
  },
  {
    id: 3,
    name: "Portable speaker",
    category: "Audio",
    price: 4200,
    currency: "KES",
    inStock: false,
  },
  {
    id: 4,
    name: "Desk light",
    category: "Workspace",
    price: 2950,
    currency: "KES",
    inStock: true,
  },
  {
    id: 5,
    name: "Laptop stand",
    category: "Workspace",
    price: 3100,
    currency: "KES",
    inStock: true,
  },
];
const headers = { "Cache-Control": "no-store", "X-RequestLab-Sandbox": "true" };
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}
async function handle(request: Request) {
  const url = new URL(request.url),
    path = url.pathname.replace(/^\/api\/mock\//, "").replace(/\/$/, "");
  if (path === "products" && ["GET", "HEAD"].includes(request.method)) {
    const raw = Number(url.searchParams.get("limit") ?? 5);
    if (!Number.isInteger(raw) || raw < 1 || raw > 5)
      return json({ error: "limit must be between 1 and 5." }, 422);
    return json({
      products: products.slice(0, raw),
      total: products.length,
      limit: raw,
      sandbox: true,
    });
  }
  if (
    /^products\/\d+$/.test(path) &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    const product = products.find((p) => p.id === Number(path.split("/")[1]));
    return product ? json(product) : json({ error: "Product not found." }, 404);
  }
  if (path === "orders" && request.method === "POST") {
    try {
      const raw = await request.text();
      if (raw.length > 24000)
        return json({ error: "Payload is too large." }, 413);
      const body = JSON.parse(raw);
      const product = products.find((p) => p.id === body?.productId);
      if (
        !product ||
        !Number.isInteger(body.quantity) ||
        body.quantity < 1 ||
        body.quantity > 20 ||
        typeof body.customer !== "string" ||
        !body.customer.trim() ||
        body.customer.length > 100
      )
        return json(
          {
            error:
              "Use an existing product, a quantity of 1–20, and a customer name.",
          },
          422,
        );
      if (!product.inStock)
        return json({ error: "Product is out of stock." }, 409);
      return json(
        {
          id: `DEMO-${crypto.randomUUID().slice(0, 8)}`,
          status: "confirmed",
          productId: product.id,
          quantity: body.quantity,
          total: product.price * body.quantity,
          currency: "KES",
          sandbox: true,
          message: "Synthetic order; no purchase or payment occurs.",
        },
        201,
      );
    } catch {
      return json({ error: "Send valid JSON." }, 400);
    }
  }
  if (
    path === "echo" &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    try {
      const raw = await request.text();
      if (raw.length > 24000)
        return json({ error: "Payload is too large." }, 413);
      const body = raw ? JSON.parse(raw) : null;
      return json({ method: request.method, body, sandbox: true });
    } catch {
      return json({ error: "Send valid JSON." }, 400);
    }
  }
  if (/^status\/\d+$/.test(path) && request.method === "GET") {
    const status = Number(path.split("/")[1]);
    if (
      ![200, 201, 400, 401, 403, 404, 409, 422, 429, 500, 503].includes(status)
    )
      return json({ error: "Unsupported sandbox status." }, 422);
    return json(
      {
        status,
        message: status < 400 ? "Sandbox success" : "Intentional sandbox error",
        sandbox: true,
      },
      status,
    );
  }
  return json(
    {
      error: "Sandbox endpoint not found.",
      endpoints: [
        "GET /products",
        "GET /products/:id",
        "POST /orders",
        "POST /echo",
        "GET /status/:code",
      ],
    },
    404,
  );
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export async function HEAD(request: Request) {
  const response = await handle(request);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
