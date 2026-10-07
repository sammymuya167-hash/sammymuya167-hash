import type { Assertion, RequestDraft, Workspace } from "./lab";
const assert = (
  kind: Assertion["kind"],
  expected: string,
  path = "",
): Assertion => ({ id: `assert-${kind}-${path}`, kind, expected, path });
const request = (
  id: string,
  name: string,
  method: RequestDraft["method"],
  path: string,
  assertions: Assertion[],
  body = "",
): RequestDraft => ({
  id,
  name,
  method,
  url: `{{base_url}}/api/mock${path}`,
  headers: [
    { id: "accept", key: "Accept", value: "application/json", enabled: true },
    {
      id: "content",
      key: "Content-Type",
      value: "application/json",
      enabled: !["GET", "HEAD"].includes(method),
    },
  ],
  body,
  assertions,
});
export const demoWorkspace: Workspace = {
  collections: [
    {
      id: "commerce",
      name: "Commerce sandbox",
      requests: [
        request("products", "List products", "GET", "/products?limit=3", [
          assert("status", "200"),
          assert("json", "3", "products.length"),
          assert("exists", "", "products.0.id"),
          assert("header", "application/json", "content-type"),
        ]),
        request("single", "Get a product", "GET", "/products/1", [
          assert("status", "200"),
          assert("json", "1", "id"),
          assert("exists", "", "price"),
        ]),
        request(
          "order",
          "Create an order",
          "POST",
          "/orders",
          [
            assert("status", "201"),
            assert("json", '"confirmed"', "status"),
            assert("exists", "", "total"),
          ],
          '{\n  "productId": 1,\n  "quantity": 2,\n  "customer": "Sample customer"\n}',
        ),
        request(
          "invalid",
          "Reject an invalid order",
          "POST",
          "/orders",
          [assert("status", "422"), assert("exists", "", "error")],
          '{\n  "productId": 1,\n  "quantity": -1\n}',
        ),
      ],
    },
    {
      id: "http",
      name: "HTTP essentials",
      requests: [
        request(
          "echo",
          "Echo a JSON payload",
          "POST",
          "/echo",
          [assert("status", "200"), assert("json", '"hello"', "body.message")],
          '{\n  "message": "hello"\n}',
        ),
        request("missing", "A missing endpoint", "GET", "/not-found", [
          assert("status", "404"),
        ]),
        request("unavailable", "Service unavailable", "GET", "/status/503", [
          assert("status", "503"),
          assert("exists", "", "message"),
        ]),
      ],
    },
  ],
  environments: [
    {
      id: "sandbox",
      name: "Built-in sandbox",
      variables: [
        { id: "base", key: "base_url", value: "{{origin}}", secret: false },
      ],
    },
    {
      id: "custom",
      name: "Your API",
      variables: [
        {
          id: "custom-base",
          key: "base_url",
          value: "https://example.com",
          secret: false,
        },
        { id: "api-token", key: "api_token", value: "", secret: true },
      ],
    },
  ],
};
